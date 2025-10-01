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
		add_filter( 'learndash_settings_fields', array( $this, 'add_godam_settings' ), 10, 2 );
		add_filter( 'ld_video_provider', array( $this, 'add_godam_provider' ), 10, 2 );
		add_filter( 'godam_player_video_element_attributes', array( $this, 'modify_godam_player_video_element_attributes' ), 10, 1 );
		add_action( 'admin_enqueue_scripts', array( $this, 'load_learndash_admin_integration_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'load_learndash_frontend_integration_script' ) );
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
	public function is_learndash_content(): bool {
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
	 * Load LearnDash frontend integration script.
	 *
	 * @since 1.4.4
	 */
	public function load_learndash_frontend_integration_script() {
		if ( $this->is_learndash_active() && $this->is_learndash_content() ) {
			wp_enqueue_script( 'rtgodam-learndash-block-integration', RTGODAM_URL . 'assets/build/js/godam-learndash-block.min.js', array( 'jquery' ), filemtime( RTGODAM_PATH . 'assets/build/js/godam-learndash-block.min.js' ), true );
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
				''   => '',
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

	/**
	 * Add custom attributes to the godam/video block for LearnDash video progression.
	 * This function checks if the video has been completed and modifies attributes accordingly.
	 *
	 * @param array $attributes Current attributes of the godam/video block.
	 *
	 * @return array
	 */
	public function modify_godam_player_video_element_attributes( array $attributes ): array {
		global $post;

		$content_video_completed = $this->is_content_video_completed( $post->ID );

		$data_unique_id = ! empty( $attributes['data-unique-id'] ) ? '(rtgodam-' . $attributes['data-unique-id'] . ')' : '(rtgodam-' . wp_generate_uuid4() . ')';
		$cookie_key     = $this->generate_cookie_key( $data_unique_id );

		if ( $content_video_completed ) {
			$attributes['data-video-cookie-key']  = $cookie_key;
			$attributes['data-video-progression'] = 'false';
			$attributes['data-video-provider']    = 'rtgodam';
		} elseif ( $this->is_learndash_active() && $this->is_learndash_content() ) {
			$attributes['data-video-cookie-key']  = $cookie_key;
			$attributes['data-video-progression'] = 'true';
			$attributes['data-video-provider']    = 'rtgodam';
		}

		return $attributes;
	}

	/**
	 * Generate a unique cookie key for storing video progression.
	 *
	 * @param string $id  Unique ID of the godam/video block.
	 *
	 * @return string
	 */
	public function generate_cookie_key( string $id ): string {
		$cookie_key = $this->generate_unique_key();

		if ( ! empty( $id ) ) {
			$cookie_key .= '_' . html_entity_decode( trim( $id ) );
		}

		return 'learndash-video-progress-' . md5( $cookie_key );
	}

	/**
	 * Generate a unique key based on user ID, course ID, and post ID.
	 *
	 * @return string
	 */
	public function generate_unique_key(): string {
		$post_id   = get_the_ID();
		$course_id = learndash_get_course_id( $post_id );
		$user_id   = (int) get_current_user_id();

		return sprintf( '%d_%d_%d', $user_id, $course_id, $post_id );
	}

	/**
	 * Check if the LearnDash content video is marked as completed.
	 *
	 * @return bool
	 */
	public function is_content_video_completed(): bool {
		if ( ! function_exists( 'learndash_get_course_progress' ) ) {
			return true;
		}

			global $post;
			$progress = learndash_get_course_progress( null, $post->ID );
			return ( ! empty( $progress['this'] ) ) && ( $progress['this'] instanceof \WP_Post ) && ( true === (bool) $progress['this']->completed );
	}

	/**
	 * Get unique ID of the godam/video block from a post.
	 *
	 * @param int $post_id The ID of the post.
	 *
	 * @return array|null Attributes of the godam/video block, or null if not found.
	 */
	public function godam_get_video_block_id_attributes( int $post_id ): ?array {
		$post = get_post( $post_id );

		if ( ! $post || empty( $post->post_content ) ) {
			return null;
		}

		$blocks = parse_blocks( $post->post_content );

		if ( empty( $blocks ) ) {
			return null;
		}

		// Recursive search in case block is inside a group/columns etc.
		$find_block = function ( $blocks ) use ( &$find_block ) {
			foreach ( $blocks as $block ) {
				if ( 'godam/video' === $block['blockName'] ) {
					return $block['attrs'] ?? array();
				}

				// Check inner blocks.
				if ( ! empty( $block['innerBlocks'] ) ) {
					$found = $find_block( $block['innerBlocks'] );
					if ( null !== $found ) {
						return $found;
					}
				}
			}
			return null;
		};

		$attrs = $find_block( $blocks );

		return $attrs['uniqueId'];
	}
}
