<?php
/**
 * EasyDamException class.
 * 
 * A Centralized class to throw all the plugin exceptions.
 *
 * @package transcoder
 */

namespace RTGODAM\Inc\Providers\Exceptions;

defined( 'ABSPATH' ) || exit;

use Exception;

/**
 * Class EasyDamException
 * 
 * A custom class to also handle the exception messages and show notices.
 */
class EasyDamException extends Exception {

	/**
	 * Show notice.
	 *
	 * @var bool
	 */
	private $show_notice = false;

	/**
	 * Notice type.
	 *
	 * @var string
	 */
	private $notice_type = 'error';

	/**
	 * Notice message.
	 * 
	 * If custom notice message is not provided, then the exception message will be used.
	 *
	 * @var string
	 */
	private $notice_message = '';

	/**
	 * Constructor.
	 *
	 * @param string  $message Message from the /Exception.
	 * @param integer $code Code from the /Exception.
	 * @param boolean $show_notice Show notice.
	 * @param string  $notice_message Notice message.
	 * @param string  $notice_type Notice type.
	 */
	public function __construct( $message, $code = 0, $show_notice = false, $notice_message = '', $notice_type = 'error' ) {
		parent::__construct( $message, $code );

		$this->show_notice    = $show_notice;
		$this->notice_message = $notice_message;
		$this->notice_type    = $notice_type;
	}

	/**
	 * Get the notice message.
	 *
	 * @return string
	 */
	public function get_notice_message() {

		if ( empty( $this->notice_message ) ) {
			return $this->getMessage();
		}

		return $this->notice_message;
	}

	/**
	 * Get the notice type.
	 *
	 * @return string
	 */
	public function get_notice_type() {
		return $this->notice_type;
	}

	/**
	 * Check if notice should be shown.
	 *
	 * @return bool
	 */
	public function should_show_notice() {
		return $this->show_notice;
	}
}
