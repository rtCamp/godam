# GoDAM - GitHub Copilot Instructions

This file contains comprehensive instructions for GitHub Copilot coding agents working on the GoDAM repository to improve efficiency, reduce errors, and minimize build failures.

## Repository Purpose

GoDAM is a powerful WordPress plugin for digital asset management that provides:
- **Video transcoding and adaptive bitrate streaming** for optimal playback across devices
- **Interactive video layers** including forms, CTAs, hotspots, and advertisements
- **WordPress Media Library organization** with folder-based file management
- **Analytics and reporting** for video engagement tracking
- **Elementor integration** with drag-and-drop widgets
- **Multi-format support** for audio and video files

The plugin serves content creators, educators, marketers, and businesses looking to enhance their video strategy with professional media management and streaming capabilities.

## Repository Overview

### Technical Stack
- **Backend**: PHP 7.4+ (WordPress 6.5+ required)
- **Frontend**: React 18.3.1, JavaScript ES6+
- **Styling**: Tailwind CSS 3.4+, SCSS
- **Build Tools**: Webpack 5, Babel, PostCSS
- **Package Managers**: npm, Composer
- **Node.js**: v22.14.0 (see `.nvmrc`)
- **Testing**: PHPUnit, Jest
- **Code Standards**: WordPress Coding Standards, ESLint

### Repository Size & Complexity
- **Languages**: PHP (primary), JavaScript/React, CSS/SCSS
- **Key Dependencies**: WordPress core, Video.js, Redux Toolkit, Uppy
- **Bundle Size**: Large (video editor ~2.85MB, analytics ~1.02MB)
- **Architecture**: Modular WordPress plugin with React-based admin interface

## Build Instructions

### Prerequisites
Ensure you have the correct versions installed:
```bash
# Check versions (required)
node --version    # Should be v22.14.0 (see .nvmrc)
npm --version     # Should be 10.8.2+
php --version     # Should be 7.4+ (8.1+ recommended)
composer --version # Should be 2.0+
```

### Environment Setup
1. **Clone and navigate to repository**:
   ```bash
   cd /path/to/godam
   ```

2. **Install dependencies** (in this exact order):
   ```bash
   # Install PHP dependencies (production only to avoid timeout issues)
   composer install --no-dev --optimize-autoloader
   
   # Install Node.js dependencies
   npm install
   ```

3. **Build assets**:
   ```bash
   # For production (recommended)
   npm run build:prod
   
   # For development
   npm run build:dev
   
   # For continuous development with file watching
   npm start
   ```

### Build Commands Reference
```bash
# Production build (creates minified assets)
npm run build:prod

# Development build (unminified, with source maps)
npm run build:dev

# Watch mode for development (rebuilds on file changes)
npm start

# Build individual components
npm run build:blocks    # WordPress blocks only
npm run build:js        # JavaScript assets only

# Linting commands
npm run lint           # Run all linters
npm run lint:js        # JavaScript/React linting
npm run lint:js:fix    # Auto-fix JS linting issues
npm run lint:css       # CSS/SCSS linting
npm run lint:css:fix   # Auto-fix CSS issues

# PHP linting (requires dev dependencies)
composer install       # Install dev dependencies first
npm run lint:php       # PHP linting with PHPCS
npm run lint:php:fix   # Auto-fix PHP issues

# Translation files
composer run pot       # Generate translation files
```

### Validation Steps

#### Pre-conditions
- Ensure Node.js version matches `.nvmrc` (v22.14.0)
- Verify WordPress environment is available
- Check that `wp-content/plugins/godam/` directory exists

#### Build Validation
```bash
# 1. Clean install and build
rm -rf node_modules/ vendor/
composer install --no-dev --optimize-autoloader
npm install
npm run build:prod

# 2. Verify build output
ls -la assets/build/    # Should contain compiled CSS/JS files
ls -la assets/build/blocks/  # Should contain block assets

# 3. Check for build warnings (acceptable but monitor)
# - Large bundle size warnings (expected for video editor)
# - Browserslist outdated warnings (can be ignored)
```

#### Post-conditions
- All files in `assets/build/` should be generated
- No fatal PHP errors during plugin activation
- WordPress admin loads without JavaScript console errors

### Common Build Errors & Solutions

#### Error: "vendor/bin/phpcs: not found"
**Solution**: Install dev dependencies first
```bash
composer install  # (without --no-dev flag)
npm run lint:php
```

#### Error: Node version conflicts
**Solution**: Use exact Node.js version
```bash
nvm use 22.14.0  # or install if not available
# Alternative: Use Docker or update .nvmrc if needed
```

#### Error: npm audit vulnerabilities (56 vulnerabilities expected)
**Workaround**: These are mostly dev dependencies and deprecated packages; safe for production
```bash
npm audit fix --production-only  # Only fix production issues
# Note: Some vulnerabilities are in @wordpress packages and cannot be easily fixed
```

#### Error: Composer timeout during install
**Solution**: Use production-only install or increase timeout
```bash
composer install --no-dev --timeout=600
```

#### Error: "Browserslist data is 6 months old"
**Note**: This is a warning, not an error. Build will complete successfully
**Optional Fix**: `npx update-browserslist-db@latest`

#### Error: SASS @import deprecation warnings
**Note**: These are warnings from WordPress core dependencies, not errors
**Status**: Will be resolved in future WordPress updates

## Project Layout

### Architectural Elements

#### Core Plugin Structure
```
/                           # Repository root
├── godam.php              # Main plugin file
├── inc/                   # PHP backend code
│   ├── classes/           # Core plugin classes
│   ├── helpers/           # Utility functions
│   ├── templates/         # PHP templates
│   └── traits/            # Reusable PHP traits
├── assets/                # Frontend assets
│   ├── src/               # Source files
│   │   ├── js/            # JavaScript source
│   │   ├── css/           # CSS/SCSS source
│   │   ├── blocks/        # WordPress block components
│   │   └── images/        # Image assets
│   └── build/             # Compiled assets (generated)
├── pages/                 # WordPress admin pages
├── languages/             # Translation files
└── wp-assets/             # WordPress.org plugin assets
```

#### Key Backend Classes (inc/classes/)
- `Media/`: Video transcoding and media handling
- `Admin/`: WordPress admin interface management
- `API/`: REST API endpoints
- `Blocks/`: WordPress block registration
- `Analytics/`: Analytics tracking system
- `Database/`: Database schema and operations

#### Frontend Architecture (assets/src/)
- `js/admin.js`: Main admin dashboard
- `js/video-editor.js`: Video editing interface
- `js/analytics.js`: Analytics dashboard
- `js/media-library.js`: Enhanced media library
- `blocks/`: WordPress Gutenberg blocks
- `css/`: Styling with Tailwind CSS

### GitHub Workflows

#### 1. PHPCS on Pull Request (`phpcs_on_pull_request.yml`)
- **Trigger**: Every pull request
- **Purpose**: Validates PHP coding standards
- **Standards**: WordPress Core, Docs, Extra, VIP-Go
- **Exclusions**: tests/, .github/, WordPress.Files.FileName

#### 2. Deploy on Push (`deploy_on_push.yml`)
- **Trigger**: Push to main/develop branches
- **Build Command**: `npm i && npm run build:prod && composer install --no-dev --optimize-autoloader`
- **Node Version**: Uses .nvmrc (v22.14.0)

#### 3. Release on Tag (`release_on_tag.yml`)
- **Trigger**: Git tags or develop branch
- **Purpose**: WordPress.org plugin deployment
- **Dry Run**: Tags starting with 'dry' or develop branch
- **Artifacts**: Creates ZIP for WordPress.org

### Key Files and Directories

#### Configuration Files
- `package.json`: Node.js dependencies and build scripts
- `composer.json`: PHP dependencies and scripts
- `webpack.config.js`: Webpack build configuration
- `tailwind.config.js`: Tailwind CSS configuration
- `phpcs.xml`: PHP CodeSniffer configuration
- `.eslintrc`: JavaScript linting rules
- `.nvmrc`: Node.js version specification

#### Development Files
- `.husky/`: Git hooks for code quality
- `.lintstagedrc.js`: Staged file linting configuration
- `babel.config.js`: JavaScript transpilation settings
- `postcss.config.js`: CSS processing configuration

#### WordPress Specific
- `godam.php`: Main plugin file with headers
- `readme.txt`: WordPress.org plugin description
- `languages/`: Translation files (.pot, .po, .mo)
- `index.php`: Security files (prevent direct access)

### Dependencies Not Evident from Structure

#### External Services
- **app.godam.io**: Video transcoding API
- **analytics.godam.io**: Analytics collection service
- **godam.io**: Main website and user management

#### WordPress Dependencies
- WordPress 6.5+ (required)
- Media Library APIs
- REST API framework
- Block Editor (Gutenberg)
- User capabilities system

#### Third-party Integrations
- Elementor (page builder)
- Gravity Forms, WPForms, Contact Form 7 (form plugins)
- Video.js (video player)
- Uppy (file upload)

## Explicit Instructions

### Search Guidance
1. **Trust these instructions first** - Only perform additional searches if information is incomplete or proven incorrect
2. **Use documented build commands** - Don't create custom build processes
3. **Follow established patterns** - When adding new features, examine existing similar code
4. **Check GitHub workflows** - Understand CI/CD requirements before making changes

### Replication Steps for Common Tasks

#### Adding a New WordPress Block
1. Create block directory: `assets/src/blocks/block-name/`
2. Add `block.json`, `index.js`, `edit.js`, `save.js`
3. Register in `inc/classes/Blocks/` PHP class
4. Build with `npm run build:blocks`
5. Test in WordPress block editor

#### Modifying Video Player
1. Edit source: `assets/src/js/components/video-player/`
2. Update styles: `assets/src/css/godam-player.scss`
3. Build: `npm run build:js`
4. Test playback functionality

#### Adding New API Endpoint
1. Create PHP class in `inc/classes/API/`
2. Follow WordPress REST API standards
3. Add security/capability checks
4. Document parameters and responses
5. Test with WordPress REST API

#### Database Schema Changes
1. Update `inc/classes/Database/Migration.php`
2. Increment plugin version in `godam.php`
3. Test upgrade path from previous version
4. Consider backward compatibility

### Performance Considerations
- **Bundle Size**: Video editor components are intentionally large; this is expected
- **Lazy Loading**: Use dynamic imports for admin-only components
- **Image Optimization**: Compress images before adding to repository
- **Database Queries**: Use WordPress caching and query optimization

### Security Guidelines
- **Sanitization**: All user inputs must be sanitized
- **Nonce Verification**: AJAX requests require nonce verification
- **Capability Checks**: Verify user permissions for all admin actions
- **SQL Injection**: Use WordPress $wpdb->prepare() for all queries

### Error Handling Patterns
```php
// PHP Error Handling
try {
    // Operation
} catch ( Exception $e ) {
    error_log( 'GoDAM Error: ' . $e->getMessage() );
    wp_send_json_error( 'Operation failed' );
}
```

```javascript
// JavaScript Error Handling
try {
    // Operation
} catch (error) {
    console.error('GoDAM Error:', error);
    // Show user-friendly message
}
```

### Testing Guidelines
- **PHP**: Use PHPUnit for unit tests
- **JavaScript**: Use Jest for component testing
- **Integration**: Test with actual WordPress installation
- **Browser**: Test video playback across different browsers
- **Performance**: Monitor bundle size and loading times

---

**Last Updated**: 2025-08-10  
**Plugin Version**: 1.3.2  
**Maintained By**: rtCamp

For questions or clarifications, refer to CONTRIBUTING.md or create an issue in the GitHub repository.