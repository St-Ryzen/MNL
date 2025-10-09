import os

base_path = r'C:\Users\Noel Periarce\documents\mnl\maloum-chatter-control\app\browser_profiles'

# Get all profile directories (excluding backups)
profiles = [d for d in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, d)) and d.startswith('account_') and not d.endswith('_existing_backup')]

total_size = 0
sizes = []

print("Calculating storage usage...")
print(f"Found {len(profiles)} active browser profiles\n")

for p in profiles:
    path = os.path.join(base_path, p)
    try:
        # Calculate directory size
        size = 0
        file_count = 0
        for root, dirs, files in os.walk(path):
            for f in files:
                try:
                    fp = os.path.join(root, f)
                    size += os.path.getsize(fp)
                    file_count += 1
                except:
                    pass

        sizes.append((p, size, file_count))
        total_size += size
    except Exception as e:
        print(f"Error reading {p}: {e}")

# Sort by size
sizes.sort(key=lambda x: x[1], reverse=True)

print(f"Total storage used: {total_size / (1024**3):.2f} GB")
print(f"\nDetailed breakdown:")
print("-" * 80)

for name, size, files in sizes:
    print(f"{name[:50]:50s} {size/(1024**2):8.1f} MB ({files:,} files)")

print("-" * 80)
print(f"{'TOTAL':50s} {total_size/(1024**2):8.1f} MB ({sum(s[2] for s in sizes):,} files)")

# Also check backup directories
backup_profiles = [d for d in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, d)) and d.endswith('_existing_backup')]
if backup_profiles:
    print(f"\nFound {len(backup_profiles)} backup directories")
    backup_total = 0
    for p in backup_profiles:
        path = os.path.join(base_path, p)
        try:
            size = sum(os.path.getsize(os.path.join(root, f)) for root, dirs, files in os.walk(path) for f in files)
            backup_total += size
        except:
            pass
    print(f"Backup storage: {backup_total / (1024**3):.2f} GB")
    print(f"TOTAL (active + backups): {(total_size + backup_total) / (1024**3):.2f} GB")
