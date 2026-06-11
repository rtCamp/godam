# Contributing to GoDAM


Thank you for your interest in contributing to GoDAM! This document provides guidelines and information for contributors to help maintain a healthy and collaborative development environment.


## Table of Contents


- [Contributing to GoDAM](#contributing-to-godam)
	- [Table of Contents](#table-of-contents)
	- [About GoDAM](#about-godam)
		- [Repository Structure](#repository-structure)
	- [Ways to Contribute](#ways-to-contribute)
		- [🐛 Bug Reports](#-bug-reports)
		- [💡 Feature Requests](#-feature-requests)
		- [📝 Documentation](#-documentation)
		- [🔧 Code Contributions](#-code-contributions)
		- [🌍 Translations](#-translations)
		- [🧪 Testing](#-testing)
	- [Development Setup](#development-setup)
		- [Prerequisites](#prerequisites)
		- [Local Environment Setup](#local-environment-setup)
		- [Development Scripts](#development-scripts)
	- [Coding Standards](#coding-standards)
		- [PHP Standards](#php-standards)
		- [JavaScript Standards](#javascript-standards)
		- [CSS/SCSS Standards](#cssscss-standards)
		- [Translation](#translation)
	- [Development Workflow](#development-workflow)
		- [Branch Naming](#branch-naming)
		- [Commit Messages](#commit-messages)
			- [Types](#types)
			- [Examples](#examples)
	- [Running Tests](#running-tests)
		- [Tier 1 — Fast PHP unit tests (Brain Monkey)](#tier-1--fast-php-unit-tests-brain-monkey)
		- [Tier 2 — PHP integration tests (wp-phpunit)](#tier-2--php-integration-tests-wp-phpunit)
		- [JavaScript tests (Jest + Testing Library)](#javascript-tests-jest--testing-library)
		- [Running everything](#running-everything)
		- [Coverage reports](#coverage-reports)


## About GoDAM


GoDAM is a powerful WordPress plugin for digital asset management that provides automatic transcoding, adaptive bitrate streaming, and interactive video layers. It simplifies the entire video workflow, from upload to optimized playback, ensuring smooth delivery across all devices and network conditions.


### Repository Structure


GoDAM consists of multiple repositories:
- **GoDAM Plugin** (this repository): Main WordPress plugin
- **GoDAM Core**: Central Media Management backend
- **GoDAM Chrome Extension**: Browser extension for screen recording
- **GoDAM Analytics**: Analytics microservice
- **GoDAM.io**: Main website


## Ways to Contribute


### 🐛 Bug Reports
Help us improve by reporting bugs with detailed information about the issue. \
Please try to provide as much information as you can so the bug can be reproduced, and consequently fixed easily.


### 💡 Feature Requests
Suggest new features or improvements to existing functionality.


### 📝 Documentation
Improve documentation, tutorials, and help content. \
Documentation is present in form of Markdown files & Docblock comments in code.


### 🔧 Code Contributions
Fix bugs, implement features, or improve performance of the plugin.


### 🌍 Translations
Help translate GoDAM into different languages for all people around the world. \
You can contribute translations to GoDAM on [translate.wordpress.org](https://translate.wordpress.org/projects/wp-plugins/godam)


### 🧪 Testing
Test new features and provide feedback on beta releases.


> [!NOTE]
> For all code related contributions, we recommend you to create an accompanying [issue](https://github.com/rtcamp/godam/issues) on GitHub first


## Development Setup


### Prerequisites


- **PHP**: 7.4 or higher
- **WordPress**: 6.5 or higher
- **Node.js**: 16+ (check `.nvmrc` for exact version)
- **Composer**: Latest version
- **Git**: Latest version


### Local Environment Setup


1. **Clone the repository**
  ```bash
  git clone https://github.com/rtCamp/godam.git
  cd godam
  ```


2. **Install dependencies**
  ```bash
  # Install PHP dependencies
  composer install
 
  # Install Node.js dependencies
  npm install
  ```


3. **Build assets**
  ```bash
  # For development
  npm run build:dev
 
  # For production
  npm run build:prod
 
  # For continuous development
  npm start
  ```


4. **WordPress Setup**
  - Set up a local WordPress environment
  - The plugin code should be present in `wp-content/plugins/godam/`
  - Activate the plugin


### Development Scripts


```bash
# Start development server
npm start


# Build for development
npm run build:dev


# Build for production
npm run build:prod


# Run linting
npm run lint


# Fix linting issues
npm run lint:js:fix
npm run lint:php:fix
npm run lint:css:fix


# Generate translation files
composer run pot
```


## Coding Standards


### PHP Standards
- Follow **WordPress Coding Standards**
- Use **WordPress VIP Go** standards
- PHPDoc comments for all functions and classes
- Use type hints where possible (PHP 7.4+)


```php
/**
* Example function with proper documentation.
*
* @since 1.3.1
* @param string $param1 Description of parameter.
* @param int    $param2 Description of parameter.
* @return bool Description of return value.
*
*/
public function example_function( string $param1, int $param2 ): bool {
   // Implementation
}
```


### JavaScript Standards
- Follow **WordPress JavaScript Coding Standards**
- Use **ESLint** configuration provided
- Prefer functional components in React
- Use TypeScript-style JSDoc comments


```javascript
/**
* Example React component.
*
* @param {Object} props - Component props.
* @param {string} props.title - The title to display.
* @return {JSX.Element} The component JSX.
*/
const ExampleComponent = ( { title } ) => {
   return <h1>{ title }</h1>;
};
```


### CSS/SCSS Standards
- Follow **WordPress CSS Coding Standards**
- Use **Tailwind CSS** classes where possible
- Use BEM methodology for custom CSS
- Mobile-first responsive design


### Translation
- All user-facing strings must be translatable
- Use `godam` as the text domain
- Include translator comments for context


```php
/* translators: %s: Video title */
$message = sprintf( __( 'Video "%s" uploaded successfully', 'godam' ), $title );
```


## Development Workflow


### Branch Naming

This repository has two important branches:
- `main` - Contains stable code that is part of current public release
- `develop` - The latest development iteration of the plugin lives here with new features & fixes

For naming your branches, you can follow the below convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `docs/description` - Documentation updates

> [!IMPORTANT]
> When you are raising a PR to the GoDAM repository, please open it against the `develop` branch instead of `main`

### Commit Messages
Follow the conventional commit format:


```
<type>[optional scope]: <description>


[optional body]


[optional footer(s)]
```


#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `chore`: Build/tool changes


#### Examples
```bash
feat(video): add adaptive bitrate streaming
fix(transcoder): resolve timeout issues
docs(readme): update installation guide
style(php): fix indentation
refactor(api): improve error handling
perf(media): optimize thumbnail generation
test(unit): add video migration tests
chore(deps): update action-scheduler
```

## Running Tests

GoDAM ships with two PHP test tiers and a Jest suite for the React/block layer.

### Tier 1 — Fast PHP unit tests (Brain Monkey)

No WordPress required. Runs on the host PHP CLI.

```bash
composer test:unit
```

These tests live in `tests/phpunit/unit/`, extend `GoDAM\Tests\TestCase`, and use Brain Monkey to fake WordPress functions. Target: < 5 s total runtime.

### Tier 2 — PHP integration tests (wp-phpunit)

Boots WordPress through `wp-phpunit`. First-time setup requires a MySQL server and the WordPress test suite:

```bash
# One-time setup (uses ~/mysql; adjust the host/user/password as needed):
bash bin/install-wp-tests.sh wordpress_test root '' 127.0.0.1 latest

# Then:
composer test:integration
```

These tests live in `tests/phpunit/integration/`, extend `GoDAM\Tests\IntegrationTestCase`, and use the standard `WP_UnitTestCase` factories.

### JavaScript tests (Jest + Testing Library)

Block and React component tests:

```bash
npm run test:js                # one-shot
npm run test:js:watch          # watch mode
npm run test:js:coverage       # with coverage report
```

JS tests live alongside source (`assets/src/**/__tests__/*.test.js`) or under `tests/js/`. The Jest preset is `@wordpress/jest-preset-default` plus `@testing-library/jest-dom` matchers.

### Running everything

```bash
composer test       # PHP unit + integration
npm test            # PHP + JS in parallel
```

### Coverage reports

```bash
composer test:coverage             # writes coverage/php/ HTML
npm run test:js:coverage           # writes coverage/js/
```

Coverage uploads to Codecov in CI; see `.codecov.yml` for the flag layout and `docs/superpowers/plans/2026-05-22-unit-testing-setup.md` for the architectural rationale and per-section coverage targets.
