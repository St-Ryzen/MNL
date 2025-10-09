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
import time
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
                download_url = self._get_download_url(release_data)
                if not download_url:
                    self.logger.warning("No valid download URL found in release assets")
                    return {
                        'update_available': False,
                        'latest_version': latest_version,
                        'current_version': self.current_version,
                        'error': 'No valid download URL available in release assets'
                    }
                    
                return {
                    'update_available': True,
                    'latest_version': latest_version,
                    'current_version': self.current_version,
                    'download_url': download_url,
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
                # Use browser_download_url instead of download_url
                return asset.get('browser_download_url', asset.get('download_url'))
        
        # Fallback to source code zip
        return release_data.get('zipball_url', release_data.get('tarball_url'))
    
    def download_and_install_update(self, update_info):
        """Download and install the update"""
        try:
            download_url = update_info['download_url']
            new_version = update_info['latest_version']

            self.logger.info(f"Starting download of version {new_version}")

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
                    'restart_required': True
                }
            else:
                return {
                    'success': False,
                    'message': 'Update failed during extraction'
                }

        except Exception as e:
            self.logger.error(f"Update failed: {str(e)}")

            return {
                'success': False,
                'message': f'Update failed: {str(e)}'
            }
    
    def _create_backup(self):
        """Create a backup of the current installation"""
        backup_dir = os.path.join(self.parent_dir, f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

        try:
            self.logger.info(f"Creating backup at: {backup_dir}")

            # Prepare for backup (close files, etc.)
            self._prepare_for_update()

            # Copy the entire app directory with retries for locked files
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    # Use ignore parameter to skip locked files
                    def ignore_locked_files(directory, files):
                        ignored = []
                        for filename in files:
                            filepath = os.path.join(directory, filename)
                            # Skip log files and backup directories
                            if filename == 'logs' or filename.startswith('backup_'):
                                ignored.append(filename)
                        return ignored

                    shutil.copytree(self.app_root, backup_dir, ignore=ignore_locked_files)
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        self.logger.warning(f"Attempt {attempt + 1} failed to create backup: {str(e)}. Retrying...")
                        time.sleep(2)
                    else:
                        self.logger.error(f"Failed to create backup after {max_retries} attempts: {str(e)}")
                        raise

            self.logger.info("Backup created successfully")
            return backup_dir

        except Exception as e:
            self.logger.error(f"Failed to create backup: {str(e)}")
            # Try to cleanup any incomplete backup
            try:
                if os.path.exists(backup_dir):
                    shutil.rmtree(backup_dir)
            except:
                pass
            raise
    
    def _extract_and_install(self, zip_path, new_version):
        """Extract the downloaded zip and install the update"""
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Extract the zip
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                
                self.logger.info(f"Extracted update to temporary directory: {temp_dir}")
                
                # Log the structure of extracted files for debugging
                self.logger.info("Searching for app directory in extracted files:")
                for root, dirs, files in os.walk(temp_dir):
                    level = root.replace(temp_dir, '').count(os.sep)
                    indent = ' ' * 2 * level
                    self.logger.info(f"{indent}{os.path.basename(root)}/")
                    subindent = ' ' * 2 * (level + 1)
                    for file in files:
                        self.logger.info(f"{subindent}{file}")
                
                # Find the app directory in the extracted files using a more flexible approach
                source_dir = self._find_app_directory_flexible(temp_dir)
                
                if not source_dir or not os.path.exists(source_dir):
                    self.logger.error(f"Could not find app directory in downloaded update")
                    raise Exception("Could not find app directory in downloaded update")
                
                self.logger.info(f"Found app directory at: {source_dir}")
                
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
    
    def _find_app_directory_flexible(self, extract_dir):
        """Find the app directory in extracted files using a flexible approach"""
        # Method 1: Look for directory named 'app' directly
        for root, dirs, files in os.walk(extract_dir):
            if 'app' in dirs and os.path.exists(os.path.join(root, 'app', 'VERSION')):
                app_dir = os.path.join(root, 'app')
                self.logger.info(f"Found app directory at: {app_dir}")
                return app_dir
        
        # Method 2: Look for directory with typical app structure
        for root, dirs, files in os.walk(extract_dir):
            for dir_name in dirs:
                potential_app_dir = os.path.join(root, dir_name)
                # Check if it looks like an app directory by checking for key files
                if (os.path.exists(os.path.join(potential_app_dir, 'VERSION')) or
                    os.path.exists(os.path.join(potential_app_dir, 'app.py')) or
                    os.path.exists(os.path.join(potential_app_dir, 'templates'))):
                    self.logger.info(f"Found potential app directory at: {potential_app_dir}")
                    return potential_app_dir
        
        # Method 3: Just return the deepest directory that looks like the main directory
        # This assumes the ZIP contains the app files directly
        self.logger.info("Trying to use extract directory as app directory")
        return extract_dir
    
    def _prepare_for_update(self):
        """Prepare system for update (close files, etc.)"""
        # Close ALL log file handlers that might be open
        import logging
        loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
        for logger in loggers:
            for handler in logger.handlers[:]:
                try:
                    handler.close()
                    logger.removeHandler(handler)
                except:
                    pass

        # Also close root logger handlers
        for handler in logging.root.handlers[:]:
            try:
                handler.close()
                logging.root.removeHandler(handler)
            except:
                pass
    
    def _copy_update_files(self, source_dir, dest_dir):
        """Copy update files, preserving critical local data"""
        preserve_files = {'.env', 'secret.key'}  # Preserve credentials and encryption key
        preserve_dirs = {'browser_profiles', 'logs', 'backups'}  # Preserve local data and logs

        for item in os.listdir(source_dir):
            source_path = os.path.join(source_dir, item)
            dest_path = os.path.join(dest_dir, item)

            if item in preserve_files:
                self.logger.info(f"Preserving local file: {item}")
                continue

            if item in preserve_dirs:
                self.logger.info(f"Preserving local directory: {item}")
                continue

            try:
                if os.path.isfile(source_path):
                    shutil.copy2(source_path, dest_path)
                    self.logger.info(f"Updated file: {item}")
                elif os.path.isdir(source_path):
                    if os.path.exists(dest_path):
                        # Try to remove, but if locked, skip it
                        try:
                            shutil.rmtree(dest_path)
                        except PermissionError:
                            self.logger.warning(f"Could not remove {item}, skipping update for this directory")
                            continue
                    shutil.copytree(source_path, dest_path)
                    self.logger.info(f"Updated directory: {item}")
            except Exception as e:
                self.logger.warning(f"Could not update {item}: {str(e)}")
    
    def _restore_backup(self, backup_path):
        """Restore from backup in case of update failure"""
        try:
            if os.path.exists(backup_path):
                self.logger.info(f"Restoring backup from: {backup_path}")
                
                # Prepare for shutdown
                self._prepare_for_update()
                
                # Try to close any remaining file handles
                import gc
                gc.collect()
                
                # Remove current app directory with retries for locked files
                temp_name = self.app_root + "_old"
                
                # Clean up any existing temp directory
                if os.path.exists(temp_name):
                    try:
                        shutil.rmtree(temp_name)
                    except Exception as e:
                        self.logger.warning(f"Could not remove existing temp directory: {str(e)}")
                
                # Move current app directory to temp name with retries
                max_retries = 5
                moved = False
                for attempt in range(max_retries):
                    try:
                        if os.path.exists(self.app_root):
                            os.rename(self.app_root, temp_name)
                        moved = True
                        break
                    except OSError as e:
                        if attempt < max_retries - 1:
                            self.logger.warning(f"Attempt {attempt + 1} failed to move app directory: {str(e)}. Waiting...")
                            import time
                            time.sleep(1)
                        else:
                            self.logger.error(f"Failed to move app directory after {max_retries} attempts: {str(e)}")
                            # Try copying instead of moving if rename fails
                            try:
                                shutil.copytree(self.app_root, temp_name)
                                # Mark original for deletion
                                with open(os.path.join(self.app_root, ".delete_on_restart"), 'w') as f:
                                    f.write("Delete this directory on restart")
                            except Exception as copy_e:
                                self.logger.error(f"Failed to copy app directory as fallback: {str(copy_e)}")
                                raise e
                
                # Restore backup
                if moved:
                    shutil.copytree(backup_path, self.app_root)
                    
                    # Clean up temp directory
                    try:
                        shutil.rmtree(temp_name)
                    except Exception as e:
                        self.logger.warning(f"Could not clean up temp directory: {str(e)}")
                
                self.logger.info("Backup restored successfully")
                return True
            else:
                self.logger.warning("No backup found to restore")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to restore backup: {str(e)}")
            return False
    
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