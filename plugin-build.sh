#!/bin/bash

# Prompt user for branch name
read -p "Enter the branch name: " GIT_BRANCH

# Define the build directory
BUILD_DIR="godam-build"

# Define the build commands
NPM_INSTALL="npm install"
BUILD_COMMAND="npm run build:prod"
BUILD_COMPOSER="composer install --optimize-autoloader --no-dev"
CLONE_REPO="git clone git@github.com:rtCamp/godam.git $BUILD_DIR"
CHECKOUT_BRANCH="git checkout $GIT_BRANCH"

# Define unwanted files and folders to remove after build
UNWANTED_ITEMS=(
    "node_modules"          # Remove node_modules
    "assets/src/blocks"     # Remove source code files
    "assets/src/css"     # Remove source code files
    "assets/src/js"     # Remove source code files
    "assets/src/libs"     # Remove source code files
    "pages/analytics"       # Remove source code files
    "pages/godam"           # Remove source code files
    "pages/help"            # Remove source code files
    "pages/media-library"   # Remove source code files
    "pages/video-editor"    # Remove source code files
    "pages/style.css"          # Remove source code files
    "tests"
    ".browserslistrc"       # Remove log files
    ".eslintignore"        
    ".eslintrc"
    ".gitignore"
    ".jscsrc"
    ".jshintignore"
    ".lintstagedrc.js"
    ".npmrc"
    ".nvmrc"
    ".stylelintignore"
    ".stylelintrc.json"
    "babel.config.js"
    "deploy.sh"
    "Gulpfile.js"
    "package-lock.json"
    "package.json"
    "phpcs.xml"
    "postcss.config.js"
    "tailwind.config.js"
    "webpack.config.js"
    ".github"
    ".git"
    "plugin-build.sh"
)

# Ensure the script runs from the project root
PROJECT_ROOT=$(pwd)
PLUGIN_BUILD_PATH="$PROJECT_ROOT/$BUILD_DIR"

# Clone the repo from github
echo "Cloning the repository..."
$CLONE_REPO

# Navigate to the build directory
cd "$PLUGIN_BUILD_PATH" || exit

# Checkout the specified branch
echo "Checking out the $GIT_BRANCH branch..."
$CHECKOUT_BRANCH

# Run the composer build command
echo "Running composer build process inside $PLUGIN_BUILD_PATH..."
$BUILD_COMPOSER

# Run npm install
echo "Installing dependencies inside $PLUGIN_BUILD_PATH..."
$NPM_INSTALL

# Check if npm install was successful
if [ $? -eq 0 ]; then
    echo "Dependencies installed successfully."
else
    echo "npm install failed. Exiting..."
    exit 1
fi

# Run the build command
echo "Running build process inside $PLUGIN_BUILD_PATH..."
$BUILD_COMMAND

# Check if the build command was successful
if [ $? -eq 0 ]; then
    echo "Build completed successfully."

    # Remove unwanted files and folders
    for item in "${UNWANTED_ITEMS[@]}"; do
        echo "Removing $item..."
        rm -rf $item
    done
    
    # Generate a .zip file
    echo "Creating a .zip file..."
    zip -r "$BUILD_DIR.zip" ./*

    # Move the .zip file to the project root
    mv "$BUILD_DIR.zip" "$PROJECT_ROOT"

    # Remove the build directory
    rm -rf "$PLUGIN_BUILD_PATH"

    echo "Cleanup completed in $PLUGIN_BUILD_PATH."
else
    echo "Build failed. Skipping cleanup."
    exit 1
fi
