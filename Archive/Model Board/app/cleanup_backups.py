#!/usr/bin/env python3
"""
Cleanup script for browser profile backup directories
Safely removes _existing_backup directories to free up storage
"""
import os
import shutil
import sys

def get_folder_size(path):
    """Calculate total size of a folder in bytes"""
    total = 0
    try:
        for root, dirs, files in os.walk(path):
            for f in files:
                try:
                    fp = os.path.join(root, f)
                    total += os.path.getsize(fp)
                except:
                    pass
    except:
        pass
    return total

def cleanup_backup_directories(base_path, dry_run=True):
    """
    Clean up _existing_backup directories

    Args:
        base_path: Path to browser_profiles directory
        dry_run: If True, only shows what would be deleted without actually deleting
    """
    if not os.path.exists(base_path):
        print(f"Error: Directory not found: {base_path}")
        return

    # Find all backup directories
    backup_dirs = []
    for item in os.listdir(base_path):
        item_path = os.path.join(base_path, item)
        if os.path.isdir(item_path) and item.endswith('_existing_backup'):
            backup_dirs.append((item, item_path))

    if not backup_dirs:
        print("No backup directories found. Nothing to clean up.")
        return

    print(f"Found {len(backup_dirs)} backup directories:\n")
    print("-" * 80)

    total_size = 0
    for name, path in backup_dirs:
        size = get_folder_size(path)
        total_size += size
        print(f"{name[:60]:60s} {size/(1024**2):8.1f} MB")

    print("-" * 80)
    print(f"{'TOTAL TO BE REMOVED':60s} {total_size/(1024**2):8.1f} MB")
    print(f"                                                    ({total_size/(1024**3):.2f} GB)")

    if dry_run:
        print("\n" + "=" * 80)
        print("DRY RUN MODE - No files were deleted")
        print("=" * 80)
        print("\nTo actually delete these backups, run:")
        print("    python cleanup_backups.py --confirm")
        return

    # Confirm deletion
    print("\n" + "=" * 80)
    print("WARNING: This will permanently delete the backup directories!")
    print("=" * 80)
    response = input("\nAre you sure you want to continue? (type 'yes' to confirm): ")

    if response.lower() != 'yes':
        print("\nCancelled. No files were deleted.")
        return

    # Delete the directories
    print("\nDeleting backup directories...")
    deleted_count = 0
    deleted_size = 0

    for name, path in backup_dirs:
        try:
            size = get_folder_size(path)
            shutil.rmtree(path)
            deleted_count += 1
            deleted_size += size
            print(f"[OK] Deleted: {name} ({size/(1024**2):.1f} MB)")
        except Exception as e:
            print(f"[ERROR] Error deleting {name}: {e}")

    print("\n" + "=" * 80)
    print(f"Cleanup complete!")
    print(f"Deleted {deleted_count} directories")
    print(f"Freed up {deleted_size/(1024**2):.1f} MB ({deleted_size/(1024**3):.2f} GB)")
    print("=" * 80)

if __name__ == "__main__":
    base_path = r'C:\Users\Noel Periarce\documents\mnl\maloum-chatter-control\app\browser_profiles'

    # Check if --confirm flag is passed
    confirm = '--confirm' in sys.argv

    if confirm:
        print("BACKUP CLEANUP UTILITY")
        print("=" * 80)
        cleanup_backup_directories(base_path, dry_run=False)
    else:
        print("BACKUP CLEANUP UTILITY (DRY RUN)")
        print("=" * 80)
        cleanup_backup_directories(base_path, dry_run=True)
