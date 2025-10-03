# How to Create a GitHub Release

## Steps to create a new release:

### 1. Update Version
```bash
# Update the version in VERSION file
echo "1.0.1" > maloum-chatter-control/VERSION
```

### 2. Update Changelog
- Add new version section to CHANGELOG.md
- Document all changes, fixes, and additions

### 3. Commit and Tag
```bash
# Commit version changes
git add .
git commit -m "Bump version to 1.0.1"

# Create and push tag
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin sub-main
git push origin v1.0.1
```

### 4. Create GitHub Release
1. Go to https://github.com/St-Ryzen/MNL/releases
2. Click "Create a new release"
3. Choose tag: `v1.0.1`
4. Release title: `Maloum Chatter Control v1.0.1`
5. Copy changelog content for this version into description
6. Check "Set as the latest release"
7. Click "Publish release"

## Current Version Status
- **Current Stable**: v1.0.0
- **Features**: Supabase session management, multi-user support, secure authentication
- **Status**: Production ready ✅

## Version Numbering
- **Major (X.0.0)**: Breaking changes, major new features
- **Minor (0.X.0)**: New features, improvements
- **Patch (0.0.X)**: Bug fixes, small improvements

## Quick Commands
```bash
# Check current version
cat maloum-chatter-control/VERSION

# See git tags
git tag -l

# View latest commits
git log --oneline -5
```