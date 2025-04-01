#!/bin/bash

# Install husky in the project

# Install husky from npm
if [ "$1" == "--install" ]; then
	echo -e "\e[1m\e[32mInstalling husky from npm\e[0m"
	npm install husky --save-dev
	npx husky init

	echo -e "\e[1m\e[32mInstalling husky hooks\e[0m"
	echo "npm run lint:staged" > .husky/pre-commit

	echo ""

	echo -e "\e[1m\e[32mHusky installed successfully\e[0m"

	echo -e "\033[1;31m"
	echo "Please commit your changes after installing husky"
	echo -e "\033[0m"
fi

# Remove husky if --remove is passed
if [ "$1" == "--remove" ]; then
	echo -e "\033[1;31m"
	echo "Removing husky from project"
	echo -e "\033[0m"
	npm uninstall husky --save-dev
	if [ "$(uname)" == "Darwin" ]; then
		rm -rf .husky
	else
		del .husky
	fi

	echo ""

	echo -e "\e[1m\e[32mHusky removed successfully\e[0m"

	echo -e "\033[1;31m"
	echo "Please commit your changes after removing husky"
	echo -e "\033[0m"
fi
