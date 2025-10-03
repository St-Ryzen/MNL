#!/usr/bin/env python3
"""
Auto-updater for Maloum Chatter Control
Checks GitHub releases and downloads/installs updates automatically
"""

import requests
import os
import shutil
import zipfile
import tempfile
import subprocess
import sys
import json
from datetime import datetime
import logging

class AutoUpdater:
    def __init__(self, current_version, repo_owner="St-Ryzen", repo_name="MNL"):
        self.current_version = current_version
        self.repo_owner = repo_owner
        self.repo_name = repo_name
        self.github_api_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/releases/latest"
        self.app_root = os.path.dirname(os.path.abspath(__file__))
        self.parent_dir = os.path.dirname(self.app_root)
        
        # Setup logging
        self.logger = logging.getLogger('updater')
        
    def check_for_updates(self):
        """Check if a newer version is available on GitHub"""
        try:
            self.logger.info(f"Checking for updates... Current version: {self.current_version}")
            
            response = requests.get(self.github_api_url, timeout=10)
            response.raise_for_status()
            
            release_data = response.json()
            latest_version = release_data['tag_name'].replace('v', '')  # Remove 'v' prefix
            
            self.logger.info(f"Latest version on GitHub: {latest_version}")
            
            if self._is_newer_version(latest_version, self.current_version):
                return {
                    'update_available': True,
                    'latest_version': latest_version,
                    'current_version': self.current_version,
                    'download_url': self._get_download_url(release_data),
                    'release_notes': release_data.get('body', 'No release notes available'),
                    'published_at': release_data.get('published_at', ''),
                    'release_name': release_data.get('name', f'Version {latest_version}')
                }
            else:
                return {
                    'update_available': False,
                    'latest_version': latest_version,
                    'current_version': self.current_version
                }
                
        except requests.RequestException as e:
            self.logger.error(f"Failed to check for updates: {str(e)}")
            return {
                'update_available': False,
                'error': f"Failed to check for updates: {str(e)}"
            }
        except Exception as e:
            self.logger.error(f"Unexpected error checking for updates: {str(e)}")
            return {
                'update_available': False,
                'error': f"Unexpected error: {str(e)}"
            }
    
    def _is_newer_version(self, latest, current):
        """Compare version strings (semantic versioning)"""
        def version_tuple(v):
            try:
                return tuple(map(int, v.split('.')))
            except:
                return (0, 0, 0)
        
        return version_tuple(latest) > version_tuple(current)
    
    def _get_download_url(self, release_data):
        """Get the download URL for the release"""
        # Look for a source code zip or release asset
        assets = release_data.get('assets', [])
        
        # Prefer a specific release asset if available
        for asset in assets:
            if asset['name'].endswith('.zip'):
                return asset['download_url']
        
        # Fallback to source code zip
        return release_data['zipball_url']
    
    def download_and_install_update(self, update_info):
        """Download and install the update"""
        try:
            download_url = update_info['download_url']
            new_version = update_info['latest_version']
            
            self.logger.info(f"Starting download of version {new_version}")
            
            # Create backup before update
            backup_path = self._create_backup()
            
            # Download the update
            with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
                self.logger.info(f"Downloading from: {download_url}")
                response = requests.get(download_url, stream=True, timeout=30)
                response.raise_for_status()
                
                total_size = int(response.headers.get('content-length', 0))
                downloaded = 0
                
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        temp_file.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            self.logger.info(f"Download progress: {progress:.1f}%")
                
                temp_zip_path = temp_file.name
            
            self.logger.info("Download completed, extracting update...")
            
            # Extract and install
            success = self._extract_and_install(temp_zip_path, new_version)
            
            # Cleanup
            os.unlink(temp_zip_path)
            
            if success:
                self.logger.info(f"Update to version {new_version} completed successfully!")
                return {
                    'success': True,
                    'message': f'Successfully updated to version {new_version}',
                    'backup_path': backup_path,
                    'restart_required': True
                }
            else:
                # Restore backup on failure
                self._restore_backup(backup_path)
                return {
                    'success': False,
                    'message': 'Update failed, backup restored',
                    'backup_path': backup_path
                }
                
        except Exception as e:
            self.logger.error(f"Update failed: {str(e)}")
            # Try to restore backup if it exists
            if 'backup_path' in locals():
                self._restore_backup(backup_path)
            
            return {
                'success': False,
                'message': f'Update failed: {str(e)}'
            }
    
    def _create_backup(self):
        """Create a backup of the current installation"""
        backup_dir = os.path.join(self.parent_dir, f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        
        try:
            self.logger.info(f"Creating backup at: {backup_dir}")
            
            # Copy the entire app directory
            shutil.copytree(self.app_root, backup_dir)
            
            self.logger.info("Backup created successfully")
            return backup_dir
            
        except Exception as e:
            self.logger.error(f"Failed to create backup: {str(e)}")
            raise
    
    def _extract_and_install(self, zip_path, new_version):
        """Extract the downloaded zip and install the update"""
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Extract the zip
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                
                # Find the extracted folder (GitHub zips have a folder inside)
                extracted_items = os.listdir(temp_dir)
                if len(extracted_items) == 1 and os.path.isdir(os.path.join(temp_dir, extracted_items[0])):
                    source_dir = os.path.join(temp_dir, extracted_items[0], 'maloum-chatter-control', 'app')
                else:
                    source_dir = os.path.join(temp_dir, 'maloum-chatter-control', 'app')
                
                if not os.path.exists(source_dir):
                    # Try alternative paths
                    for item in extracted_items:
                        potential_path = os.path.join(temp_dir, item, 'maloum-chatter-control', 'app')
                        if os.path.exists(potential_path):
                            source_dir = potential_path
                            break
                    else:
                        raise Exception("Could not find app directory in downloaded update")
                
                # Stop any running processes that might lock files
                self._prepare_for_update()
                
                # Copy new files over existing ones
                self._copy_update_files(source_dir, self.app_root)
                
                # Update the VERSION file
                version_file = os.path.join(self.app_root, 'VERSION')
                with open(version_file, 'w') as f:
                    f.write(new_version)
                
                return True
                
        except Exception as e:
            self.logger.error(f"Failed to extract and install update: {str(e)}")
            return False
    
    def _prepare_for_update(self):
        """Prepare system for update (close files, etc.)"""
        # Close any log file handlers that might be open
        for handler in self.logger.handlers[:]:
            handler.close()
            self.logger.removeHandler(handler)
    
    def _copy_update_files(self, source_dir, dest_dir):
        """Copy update files, preserving certain local files"""
        preserve_files = {'.env', 'secret.key'}  # Don't overwrite these
        preserve_dirs = {'browser_profiles', 'instance', 'logs'}  # Don't overwrite these
        
        for item in os.listdir(source_dir):
            source_path = os.path.join(source_dir, item)
            dest_path = os.path.join(dest_dir, item)
            
            if item in preserve_files:
                self.logger.info(f"Preserving local file: {item}")
                continue
            
            if item in preserve_dirs:
                self.logger.info(f"Preserving local directory: {item}")
                continue
            
            if os.path.isfile(source_path):
                shutil.copy2(source_path, dest_path)
                self.logger.info(f"Updated file: {item}")
            elif os.path.isdir(source_path):
                if os.path.exists(dest_path):
                    shutil.rmtree(dest_path)
                shutil.copytree(source_path, dest_path)
                self.logger.info(f"Updated directory: {item}")
    
    def _restore_backup(self, backup_path):
        """Restore from backup in case of update failure"""
        try:
            if os.path.exists(backup_path):
                self.logger.info(f"Restoring backup from: {backup_path}")
                
                # Remove current app directory
                temp_name = self.app_root + "_old"
                if os.path.exists(temp_name):
                    shutil.rmtree(temp_name)
                
                os.rename(self.app_root, temp_name)
                
                # Restore backup
                shutil.copytree(backup_path, self.app_root)
                
                # Remove old directory
                shutil.rmtree(temp_name)
                
                self.logger.info("Backup restored successfully")
                
        except Exception as e:
            self.logger.error(f"Failed to restore backup: {str(e)}")
    
    def cleanup_old_backups(self, keep_count=3):
        """Clean up old backup directories, keeping only the most recent ones"""
        try:
            backup_dirs = []
            for item in os.listdir(self.parent_dir):
                if item.startswith('backup_') and os.path.isdir(os.path.join(self.parent_dir, item)):
                    backup_dirs.append(item)
            
            # Sort by name (which includes timestamp)
            backup_dirs.sort(reverse=True)
            
            # Remove old backups
            for old_backup in backup_dirs[keep_count:]:
                old_path = os.path.join(self.parent_dir, old_backup)
                shutil.rmtree(old_path)
                self.logger.info(f"Cleaned up old backup: {old_backup}")
                
        except Exception as e:
            self.logger.error(f"Failed to cleanup old backups: {str(e)}")

def get_app_version():
    """Helper function to get current version"""
    try:
        version_file = os.path.join(os.path.dirname(__file__), 'VERSION')
        with open(version_file, 'r') as f:
            return f.read().strip()
    except:
        return "Unknown"