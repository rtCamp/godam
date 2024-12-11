<?php
/**
 * Assets class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class Assets
 */
class Assets {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	protected function setup_hooks() {

		/**
		 * Action
		 */
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'admin_enqueue_scripts' ] );

	}

	/**
	 * To enqueue scripts and styles.
	 *
	 * @return void
	 */
	public function enqueue_scripts() {

		wp_register_script(
			'easydam-script',
			RT_TRANSCODER_URL . '/assets/build/js/main.js',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/js/main.js' ),
			true
		);

		wp_register_style(
			'easydam-style',
			RT_TRANSCODER_URL . '/assets/build/css/main.css',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/css/main.css' )
		);

		wp_enqueue_script( 'easydam-script' );
		wp_enqueue_style( 'easydam-style' );

	}

	/**
	 * To enqueue scripts and styles. in admin.
	 *
	 * @param string $hook_suffix Admin page name.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {

		wp_register_script(
			'easydam-script',
			RT_TRANSCODER_URL . '/assets/build/js/admin.js',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/js/admin.js' ),
			true
		);

		wp_register_style(
			'easydam-style',
			RT_TRANSCODER_URL . '/assets/build/css/admin.css',
			array(),
			filemtime( RT_TRANSCODER_PATH . '/assets/build/css/admin.css' )
		);

		wp_enqueue_script( 'easydam-script' );
		wp_enqueue_style( 'easydam-style' );

	}
}
