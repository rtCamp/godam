<?php
/**
 * HTTP Status Code enum class.
 *
 * Acts as a PHP enum for HTTP status codes since PHP native enums
 * require PHP 8.1+ which may not be available in all environments.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * Class HTTP_Status_Code
 *
 * Common HTTP status codes used throughout the plugin.
 */
class HTTP_Status_Code {

	// 2xx Success.
	const OK         = 200;
	const CREATED    = 201;
	const NO_CONTENT = 204;

	// 3xx Redirection.
	const MOVED_PERMANENTLY = 301;
	const FOUND             = 302;
	const NOT_MODIFIED      = 304;

	// 4xx Client Error.
	const BAD_REQUEST          = 400;
	const UNAUTHORIZED         = 401;
	const FORBIDDEN            = 403;
	const NOT_FOUND            = 404;
	const METHOD_NOT_ALLOWED   = 405;
	const CONFLICT             = 409;
	const UNPROCESSABLE_ENTITY = 422;
	const TOO_MANY_REQUESTS    = 429;

	// 5xx Server Error.
	const INTERNAL_SERVER_ERROR = 500;
	const BAD_GATEWAY           = 502;
	const SERVICE_UNAVAILABLE   = 503;
	const GATEWAY_TIMEOUT       = 504;

	/**
	 * Check if a status code indicates a server error (5xx).
	 *
	 * @param int $code HTTP status code.
	 *
	 * @return bool True if the code is a 5xx server error.
	 */
	public static function is_server_error( $code ) {
		return $code >= 500 && $code < 600;
	}

	/**
	 * Check if a status code indicates a client error (4xx).
	 *
	 * @param int $code HTTP status code.
	 *
	 * @return bool True if the code is a 4xx client error.
	 */
	public static function is_client_error( $code ) {
		return $code >= 400 && $code < 500;
	}

	/**
	 * Check if a status code indicates success (2xx).
	 *
	 * @param int $code HTTP status code.
	 *
	 * @return bool True if the code is a 2xx success.
	 */
	public static function is_success( $code ) {
		return $code >= 200 && $code < 300;
	}
}
