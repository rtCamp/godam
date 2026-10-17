<?php
// Temporary canary: PHP 8.0 constructor promotion. The PHP 7.4 job must fail on it.
// Removed in the next commit.
final class Php_Syntax_Canary {
	public function __construct( private int $value ) {}
}
