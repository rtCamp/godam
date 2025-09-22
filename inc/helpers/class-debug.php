<?php
/**
 * Debug Utility Class
 *
 * A simple centralized debugging utility for the GoDAM plugin.
 * Only logs to error_log by default, with optional admin notices.
 *
 * @package RTGODAM\Inc\Helpers
 */

namespace RTGODAM\Inc\Helpers;

defined( 'ABSPATH' ) || exit;

/**
 * Class Debug
 *
 * Simple debugging utility for the GoDAM plugin.
 * Logs to error_log with optional admin notices for important messages.
 *
 * @since n.e.x.t
 */
class Debug {

	/**
	 * Debug levels
	 */
	const LEVEL_ERROR   = 'ERROR';
	const LEVEL_WARNING = 'WARNING';
	const LEVEL_INFO    = 'INFO';

	/**
	 * Plugin prefix for all log messages
	 */
	const LOG_PREFIX = '[GoDAM]';

	/**
	 * Whether debugging is enabled
	 *
	 * @var bool
	 */
	private static $debug_enabled = null;

	/**
	 * Whether to log to file
	 *
	 * @var bool
	 */
	private static $log_to_file = null;

	/**
	 * Initialize debug settings
	 *
	 * @since n.e.x.t
	 */
	private static function init() {
		if ( null === self::$debug_enabled ) {
			self::$debug_enabled = defined( 'WP_DEBUG' ) && WP_DEBUG;
			self::$log_to_file   = defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG;
		}
	}

	/**
	 * Log an error message
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message     The error message.
	 * @param string $context     Optional. The context (class::method).
	 * @param bool   $admin_notice Optional. Show admin notice if true.
	 */
	public static function error( $message, $context = '', $admin_notice = false ) {
		self::log( $message, self::LEVEL_ERROR, $context, $admin_notice );
	}

	/**
	 * Log a warning message
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message     The warning message.
	 * @param string $context     Optional. The context (class::method).
	 * @param bool   $admin_notice Optional. Show admin notice if true.
	 */
	public static function warning( $message, $context = '', $admin_notice = false ) {
		self::log( $message, self::LEVEL_WARNING, $context, $admin_notice );
	}

	/**
	 * Log an info message
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message The info message.
	 * @param string $context Optional. The context (class::method).
	 */
	public static function info( $message, $context = '' ) {
		self::log( $message, self::LEVEL_INFO, $context );
	}

	/**
	 * Log a message with specified level
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message     The message to log.
	 * @param string $level       The log level.
	 * @param string $context     Optional. The context (class::method).
	 * @param bool   $admin_notice Optional. Show admin notice if true.
	 */
	public static function log( $message, $level = self::LEVEL_INFO, $context = '', $admin_notice = false ) {
		self::init();

		// Don't log if debugging is disabled.
		if ( ! self::$debug_enabled ) {
			return;
		}

		$formatted_message = self::format_message( $message, $level, $context );

		// Always log to WordPress error log.
		if ( self::$log_to_file ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- This is a debug utility.
			error_log( $formatted_message );
		}

		// Show admin notices only if specifically requested.
		if ( $admin_notice && is_admin() && in_array( $level, array( self::LEVEL_ERROR, self::LEVEL_WARNING ), true ) ) {
			self::add_admin_notice( $message, $level );
		}
	}

	/**
	 * Format the log message
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message The message.
	 * @param string $level   The log level.
	 * @param string $context The context.
	 * @return string Formatted message.
	 */
	private static function format_message( $message, $level, $context = '' ) {
		$context_str = $context ? " [{$context}]" : '';

		return sprintf(
			'%s [%s]%s %s',
			self::LOG_PREFIX,
			$level,
			$context_str,
			$message
		);
	}

	/**
	 * Add admin notice for errors and warnings
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message The message.
	 * @param string $level   The log level.
	 */
	private static function add_admin_notice( $message, $level ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$notice_type = ( self::LEVEL_ERROR === $level ) ? 'error' : 'warning';

		add_action(
			'admin_notices',
			function () use ( $message, $notice_type ) {
				printf(
					'<div class="notice notice-%s is-dismissible"><p><strong>%s:</strong> %s</p></div>',
					esc_attr( $notice_type ),
					esc_html( self::LOG_PREFIX ),
					esc_html( $message )
				);
			}
		);
	}

	/**
	 * Check if debugging is enabled
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public static function is_debug_enabled() {
		self::init();
		return self::$debug_enabled;
	}
}
