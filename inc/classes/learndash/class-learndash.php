<?php
/**
 * LearnDash integration class for GoDAM plugin.
 * Loads required integration script.
 *
 * @since 1.4.4
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\LearnDash;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class LearnDash
 *
 * @since 1.4.4
 */
class LearnDash {

	use Singleton;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup WordPress hooks and filters.
	 */
	private function setup_hooks() {
		add_action( 'admin_enqueue_scripts', array( $this, 'load_learndash_admin_integration_scripts' ) );
		add_filter( 'learndash_settings_fields', array( $this, 'add_godam_settings' ), 10, 2 );
	}

	/**
	 * Check if LearnDash plugin is active.
	 *
	 * @since 1.4.4
	 *
	 * @return bool
	 */
	public function is_learndash_active(): bool {
		if ( function_exists( 'is_plugin_active' ) && ! is_plugin_active( 'sfwd-lms/sfwd_lms.php' ) ) {
			return false;
		}

		return class_exists( '\SFWD_LMS' ) && defined( 'LEARNDASH_VERSION' );
	}

	/**
	 * Check if the current content is LearnDash content (lesson, topic).
	 *
	 * @since 1.4.4
	 *
	 * @return bool
	 */
	public function is_learndash_content() {
		global $post;

		if ( ! isset( $post ) || ! isset( $post->post_type ) ) {
			return false;
		}

		return in_array( $post->post_type, array( 'sfwd-lessons', 'sfwd-topic' ) );
	}

	/**
	 * Load LearnDash admin integration scripts.
	 *
	 * @since 1.4.4
	 */
	public function load_learndash_admin_integration_scripts() {

		if ( $this->is_learndash_active() && $this->is_learndash_content() ) {
			wp_enqueue_script( 'rtgodam-learndash-admin-integration', RTGODAM_URL . 'assets/build/js/godam-learndash-admin.min.js', array( 'jquery' ), filemtime( RTGODAM_PATH . 'assets/build/js/godam-learndash-admin.min.js' ), true );
		}
	}

	/**
	 * Add GoDAM settings to LearnDash lesson and topic settings.
	 *
	 * @param array  $settings  Existing settings array.
	 * @param string $screen_id Current screen ID.
	 *
	 * @return array Modified settings array.
	 * @since 1.4.4
	 */
	public function add_godam_settings( array $settings, string $screen_id ): array {
		if ( ! in_array(
			$screen_id,
			array(
				'learndash-lesson-display-content-settings',
				'learndash-topic-display-content-settings',
			)
		) ) {
			return $settings;
		}

		$rtgodam_setting = array(
			'parent_setting' => 'lesson_video_enabled',
			'type'           => 'checkbox-switch',
			'label'          => esc_html__( 'Enable GoDAM Video Progression', 'godam' ),
			'name'           => 'lesson_godam_block_progression_enabled',
			'value'          => ! empty( $settings['lesson_godam_block_progression_enabled'] ) ? $settings['lesson_godam_block_progression_enabled'] : '',
			'help_text'      => esc_html__( 'Enable this option to use GoDAM Video block progression for lessons.', 'godam' ),
			'default'        => 'off',
			'options'        => array(
				'on' => esc_html__( 'GoDAM Video block added in this post will be used for video progression', 'godam' ),
				''   => esc_html__( 'Off', 'godam' ),
			),
		);

		// Insert the godam setting before the 'lesson_video_url' setting.
		$insert_position = array_search( 'lesson_video_url', array_keys( $settings ), true );
		if ( false !== $insert_position ) {
			$settings = array_slice( $settings, 0, $insert_position, true ) +
						array( 'lesson_godam_block_progression_enabled' => $rtgodam_setting ) +
						array_slice( $settings, $insert_position, null, true );
		}


		return $settings;
	}

	/**
	 * Add GoDAM provider if GoDAM video URL is detected.
	 *
	 * @param string $video_provider Current video provider.
	 * @param array  $settings      Lesson settings array.
	 */
	public function add_godam_provider( string $video_provider, array $settings ): string {
		if ( false !== strpos( $settings['lesson_video_url'], '(rtgodam' ) ) {
			return 'rtgodam';
		}
		return $video_provider;
	}
}
