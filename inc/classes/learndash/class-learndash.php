<?php
/**
 * LearnDash integration: GoDAM videos for LearnDash Video Progression.
 *
 * LearnDash builds the lesson video itself: it decides when the video is shown
 * (Display Timing, the [ld_video] placeholder, completed steps, admins who
 * bypass progression), wraps it in `.ld-video` with the cookie key its server
 * side Mark Complete check reads, and works out auto-complete, the delay
 * message and the hidden Mark Complete button. This class lets GoDAM videos go
 * through that same path instead of copying it:
 *
 * - `ld_video_provider` sends a GoDAM source down LearnDash's `local` path,
 *   which is the only path that renders shortcodes, iframes and URLs for a
 *   provider LearnDash does not know.
 * - The `[video_godam]` shortcode renders the video when "Use GoDAM Video" is
 *   on: the one picked in the lesson settings (`[video_godam id="123"]`), or
 *   the lesson's first GoDAM Video block when none is picked (BLOCK_MARKER).
 *   `wp_video_shortcode_override` renders the GoDAM embed for a GoDAM URL,
 *   which that path wraps in `[video]`.
 * - `learndash_lesson_video_data` renames the provider to `godam` right before
 *   LearnDash writes the wrapper and the `learndash_video_data` script object,
 *   so LearnDash's own player code leaves the video alone and
 *   `assets/src/js/learndash/frontend.js` drives it with LearnDash's progress
 *   helpers.
 *
 * "Use GoDAM Video" and the picked video are not settings LearnDash saves, since
 * it saves only the fields in its own map. Both are stored as the marker in the
 * Video URL setting, which LearnDash needs to be non-empty for progression to
 * stay on. Its cookie key includes that value, so picking another video starts
 * the learner's progress over.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\LearnDash;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class LearnDash
 *
 * @since n.e.x.t
 */
class LearnDash {

	use Singleton;

	/**
	 * Provider name GoDAM videos get in LearnDash's video data and wrapper.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const PROVIDER = 'godam';

	/**
	 * Video URL setting value that means "use the GoDAM Video block in the content".
	 *
	 * With a video picked in the settings, the marker carries it instead:
	 * `[video_godam id="123"]` (see build_marker()).
	 *
	 * LearnDash treats a value starting with `[video` as a video shortcode and
	 * renders it with do_shortcode(). It is GoDAM's own shortcode, not WordPress's
	 * `[video]`, so other plugins that override `[video]` (Jetpack VideoPress
	 * empties its output) cannot replace it.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const BLOCK_MARKER = '[video_godam]';

	/**
	 * Tag of the BLOCK_MARKER shortcode.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const SHORTCODE = 'video_godam';

	/**
	 * Name of the "Use GoDAM Video" field in the lesson and topic settings.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const FIELD = 'lesson_video_godam';

	/**
	 * Name of the picked GoDAM video field in the lesson and topic settings.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const VIDEO_FIELD = 'lesson_video_godam_id';

	/**
	 * LearnDash settings metaboxes that hold the Video Progression settings.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const METABOX_KEYS = array(
		'learndash-lesson-display-content-settings',
		'learndash-topic-display-content-settings',
	);

	/**
	 * LearnDash post types that have Video Progression.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const POST_TYPES = array( 'sfwd-lessons', 'sfwd-topic' );

	/**
	 * Block name of the GoDAM Video block.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const VIDEO_BLOCK = 'godam/video';

	/**
	 * Whether a GoDAM video went through LearnDash's video path on this request.
	 *
	 * @since n.e.x.t
	 *
	 * @var bool
	 */
	private $has_godam_video = false;

	/**
	 * Whether the lesson's GoDAM Video block is being rendered for LearnDash.
	 *
	 * @since n.e.x.t
	 *
	 * @var bool
	 */
	private $rendering_for_learndash = false;

	/**
	 * First GoDAM Video block of each post, keyed by post ID (null when it has none).
	 *
	 * @since n.e.x.t
	 *
	 * @var array<int, array|null>
	 */
	private $video_blocks = array();

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup WordPress hooks and filters.
	 *
	 * All of them are LearnDash hooks or check for a LearnDash lesson or topic
	 * first, so they do nothing when LearnDash is not active.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	private function setup_hooks() {
		// Lesson and topic settings.
		add_filter( 'learndash_settings_fields', array( $this, 'add_settings_field' ), 10, 2 );
		foreach ( self::METABOX_KEYS as $metabox_key ) {
			// Before LearnDash's own filter (priority 30), which turns progression off when the Video URL is empty.
			add_filter( 'learndash_metabox_save_fields_' . $metabox_key, array( $this, 'save_settings_field' ), 10, 2 );
		}
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_script' ) );

		// Front end.
		add_filter( 'ld_video_provider', array( $this, 'filter_video_provider' ), 10, 2 );
		add_shortcode( self::SHORTCODE, array( $this, 'render_block_shortcode' ) );
		// After Jetpack VideoPress (priority 10), which returns '' for every [video] that is not on VideoPress.
		add_filter( 'wp_video_shortcode_override', array( $this, 'render_video_shortcode' ), 20, 2 );
		add_filter( 'learndash_lesson_video_data', array( $this, 'filter_video_data' ), 10, 2 );
		add_filter( 'render_block_' . self::VIDEO_BLOCK, array( $this, 'maybe_hide_video_block' ), 10, 2 );
		// After LearnDash enqueues its video script (wp_footer, priority 1), before footer scripts print.
		add_action( 'wp_footer', array( $this, 'enqueue_frontend_script' ), 5 );
	}

	/**
	 * Read the picked video out of a Video URL setting value that is the marker.
	 *
	 * LearnDash escapes the value when it saves it, so the stored value can hold
	 * HTML entities.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed $video_url Video URL setting value.
	 *
	 * @return int|null The picked attachment ID, 0 for BLOCK_MARKER, or null when the value is not the marker.
	 */
	public static function get_marker_video_id( $video_url ) {
		if ( ! is_string( $video_url ) ) {
			return null;
		}

		$value = trim( html_entity_decode( $video_url, ENT_QUOTES ) );
		if ( ! preg_match( '/^\[' . self::SHORTCODE . '(?:\s+id=(["\']?)(\d+)\1)?\s*\]$/', $value, $matches ) ) {
			return null;
		}

		return isset( $matches[2] ) ? (int) $matches[2] : 0;
	}

	/**
	 * Whether a Video URL setting value is the marker "Use GoDAM Video" stores.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed $video_url Video URL setting value.
	 *
	 * @return bool
	 */
	public static function is_marker( $video_url ): bool {
		return null !== self::get_marker_video_id( $video_url );
	}

	/**
	 * Build the marker for a picked video, or BLOCK_MARKER when none is picked.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $video_id Picked attachment ID, or 0.
	 *
	 * @return string
	 */
	public static function build_marker( int $video_id ): string {
		return $video_id > 0 ? sprintf( '[%s id="%d"]', self::SHORTCODE, $video_id ) : self::BLOCK_MARKER;
	}

	/**
	 * Whether a Video URL setting value points at a GoDAM-hosted video.
	 *
	 * Accepts a URL, an iframe embed code or a shortcode, so it checks every URL
	 * in the value. Only a URL whose host is exactly the GoDAM API host counts.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed $video_url Video URL setting value.
	 *
	 * @return bool
	 */
	public static function is_godam_url( $video_url ): bool {
		if ( ! is_string( $video_url ) || '' === $video_url ) {
			return false;
		}

		$api_host = wp_parse_url( RTGODAM_API_BASE, PHP_URL_HOST );
		if ( ! is_string( $api_host ) || '' === $api_host ) {
			return false;
		}

		if ( ! preg_match_all( '#https?://([^/\s"\'<>\[\]?]+)#i', html_entity_decode( $video_url, ENT_QUOTES ), $matches ) ) {
			return false;
		}

		foreach ( $matches[1] as $host ) {
			if ( strtolower( $host ) === strtolower( $api_host ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Whether a Video URL setting value is a GoDAM source this class handles.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed $video_url Video URL setting value.
	 *
	 * @return bool
	 */
	public static function is_godam_source( $video_url ): bool {
		return self::is_marker( $video_url ) || self::is_godam_url( $video_url );
	}

	/**
	 * Find the first GoDAM Video block in a list of parsed blocks, inner blocks included.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $blocks Parsed blocks, as parse_blocks() returns them.
	 *
	 * @return array|null The parsed block, or null when there is none.
	 */
	public static function find_video_block( array $blocks ) {
		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			if ( isset( $block['blockName'] ) && self::VIDEO_BLOCK === $block['blockName'] ) {
				return $block;
			}

			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$found = self::find_video_block( $block['innerBlocks'] );
				if ( null !== $found ) {
					return $found;
				}
			}
		}

		return null;
	}

	/**
	 * Apply the "Use GoDAM Video" choice to the settings LearnDash is about to save.
	 *
	 * On, it stores the marker for the picked video (BLOCK_MARKER when none is
	 * picked) as the Video URL. Off, it clears a Video URL that is still the
	 * marker, so LearnDash turns progression off unless a different video is
	 * entered.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $settings  Settings LearnDash is about to save.
	 * @param bool  $use_godam Whether "Use GoDAM Video" is on.
	 * @param int   $video_id  Picked attachment ID, or 0.
	 *
	 * @return array
	 */
	public static function apply_use_godam_setting( array $settings, bool $use_godam, int $video_id = 0 ): array {
		if ( $use_godam ) {
			$settings['lesson_video_url'] = self::build_marker( $video_id );
		} elseif ( isset( $settings['lesson_video_url'] ) && self::is_marker( $settings['lesson_video_url'] ) ) {
			$settings['lesson_video_url'] = '';
		}

		return $settings;
	}

	/**
	 * Add the "Use GoDAM Video" switch and the video picker above the Video URL field.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $fields      Settings fields of the metabox.
	 * @param string $metabox_key Metabox key.
	 *
	 * @return array
	 */
	public function add_settings_field( $fields, $metabox_key ) {
		if ( ! is_array( $fields ) || ! in_array( $metabox_key, self::METABOX_KEYS, true ) || ! isset( $fields['lesson_video_url'] ) ) {
			return $fields;
		}

		$video_id = self::get_marker_video_id( $fields['lesson_video_url']['value'] ?? '' );

		$switch = array(
			'name'           => self::FIELD,
			'label'          => esc_html__( 'Use GoDAM Video', 'godam' ),
			'type'           => 'checkbox-switch',
			'value'          => null !== $video_id ? 'on' : '',
			'default'        => '',
			'help_text'      => esc_html__( 'Use a GoDAM video as the progression video. Add [ld_video] to the content to choose where it appears.', 'godam' ),
			'options'        => array(
				'on' => esc_html__( 'A GoDAM video is the progression video', 'godam' ),
				''   => '',
			),
			'parent_setting' => 'lesson_video_enabled',
		);

		$picker = array(
			'name'           => self::VIDEO_FIELD,
			'label'          => esc_html__( 'GoDAM Video', 'godam' ),
			'type'           => 'custom',
			'html'           => self::get_picker_html( $metabox_key, (int) $video_id ),
			'help_text'      => esc_html__( 'The video learners watch to complete this step. With none selected, the first GoDAM Video block in the content is used.', 'godam' ),
			'parent_setting' => 'lesson_video_enabled',
		);

		$position = array_search( 'lesson_video_url', array_keys( $fields ), true );

		return array_slice( $fields, 0, $position, true )
			+ array(
				self::FIELD       => $switch,
				self::VIDEO_FIELD => $picker,
			)
			+ array_slice( $fields, $position, null, true );
	}

	/**
	 * Build the video picker markup: the posted field, a preview and its buttons.
	 *
	 * The media library opens from it through assets/src/js/learndash/admin.js.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $metabox_key Metabox key.
	 * @param int    $video_id    Picked attachment ID, or 0.
	 *
	 * @return string
	 */
	public static function get_picker_html( string $metabox_key, int $video_id ): string {
		$field_id = $metabox_key . '_' . self::VIDEO_FIELD;
		$title    = '';

		if ( $video_id > 0 ) {
			/** This action is documented in inc/classes/class-pages.php */
			do_action( 'rtgodam_before_attachment_lookup' );
			$title = get_the_title( $video_id );
			/** This action is documented in inc/classes/class-pages.php */
			do_action( 'rtgodam_after_attachment_lookup' );
		}

		$picked = $video_id > 0;

		return sprintf(
			'<div class="rtgodam-ld-video-picker%1$s" id="%2$s_picker">'
			. '<input type="hidden" id="%2$s" name="%3$s[%4$s]" value="%5$s" />'
			. '<div class="rtgodam-ld-video-picker__preview"></div>'
			. '<p class="rtgodam-ld-video-picker__title"%6$s>%7$s</p>'
			. '<div class="rtgodam-ld-video-picker__actions">'
			. '<button type="button" class="button rtgodam-ld-video-picker__select">%8$s</button>'
			. '<button type="button" class="button rtgodam-ld-video-picker__remove"%9$s>%10$s</button>'
			. '</div>'
			. '</div>',
			$picked ? ' is-picked' : '',
			esc_attr( $field_id ),
			esc_attr( $metabox_key ),
			esc_attr( self::VIDEO_FIELD ),
			esc_attr( $picked ? (string) $video_id : '' ),
			$picked ? '' : ' hidden',
			esc_html( $title ),
			$picked ? esc_html__( 'Replace', 'godam' ) : esc_html__( 'Select video', 'godam' ),
			$picked ? '' : ' hidden',
			esc_html__( 'Remove', 'godam' )
		);
	}

	/**
	 * Save the "Use GoDAM Video" switch into the Video URL setting.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $settings    Settings LearnDash is about to save.
	 * @param string $metabox_key Metabox key.
	 *
	 * @return array
	 */
	public function save_settings_field( $settings, $metabox_key ) {
		// LearnDash fills the Video URL only after it checks the metabox nonce for this form.
		if ( ! is_array( $settings ) || ! array_key_exists( 'lesson_video_url', $settings ) ) {
			return $settings;
		}

		/*
		 * Only the settings form has the switch. LearnDash runs this filter for
		 * REST saves too, which never post it; an unchecked switch posts nothing
		 * either, so the form itself has to be there to read the switch as off.
		 */
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- LearnDash verified the metabox nonce before running this filter.
		if ( ! isset( $_POST[ $metabox_key ] ) || ! is_array( $_POST[ $metabox_key ] ) ) {
			return $settings;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- LearnDash verified the metabox nonce before running this filter.
		$posted = isset( $_POST[ $metabox_key ][ self::FIELD ] ) ? sanitize_text_field( wp_unslash( $_POST[ $metabox_key ][ self::FIELD ] ) ) : '';
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- LearnDash verified the metabox nonce before running this filter.
		$video_id = isset( $_POST[ $metabox_key ][ self::VIDEO_FIELD ] ) ? absint( wp_unslash( $_POST[ $metabox_key ][ self::VIDEO_FIELD ] ) ) : 0;

		// Only a video can be the progression video.
		if ( $video_id > 0 && ! static::is_picked_video( $video_id ) ) {
			$video_id = 0;
		}

		return self::apply_use_godam_setting( $settings, 'on' === $posted, $video_id );
	}

	/**
	 * Whether a picked attachment is a video, so it can be the progression video.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return bool
	 */
	public static function is_picked_video( int $attachment_id ): bool {
		if ( $attachment_id <= 0 ) {
			return false;
		}

		/** This action is documented in inc/classes/class-pages.php */
		do_action( 'rtgodam_before_attachment_lookup' );
		$is_video = 'attachment' === get_post_type( $attachment_id )
			&& 0 === strpos( (string) get_post_mime_type( $attachment_id ), 'video/' );
		/** This action is documented in inc/classes/class-pages.php */
		do_action( 'rtgodam_after_attachment_lookup' );

		return $is_video;
	}

	/**
	 * Load the script that shows and hides the Video URL field with the switch.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $hook_suffix Admin page hook suffix.
	 *
	 * @return void
	 */
	public function enqueue_admin_script( $hook_suffix ) {
		if ( ! in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || ! in_array( $screen->post_type, self::POST_TYPES, true ) || ! defined( 'LEARNDASH_VERSION' ) ) {
			return;
		}

		$asset = RTGODAM_PATH . 'assets/build/js/godam-learndash-admin.min.js';
		if ( ! file_exists( $asset ) ) {
			return;
		}

		// The video picker opens the media library, GoDAM tab included.
		wp_enqueue_media();

		wp_enqueue_script(
			'rtgodam-learndash-admin',
			RTGODAM_URL . 'assets/build/js/godam-learndash-admin.min.js',
			array( 'media-editor' ),
			filemtime( $asset ),
			true
		);

		wp_localize_script(
			'rtgodam-learndash-admin',
			'rtgodamLearnDashAdmin',
			array(
				'field'       => self::FIELD,
				'videoField'  => self::VIDEO_FIELD,
				'markerTag'   => self::SHORTCODE,
				'metaboxKeys' => self::METABOX_KEYS,
				'i18n'        => array(
					'frameTitle'  => __( 'Select the progression video', 'godam' ),
					'frameButton' => __( 'Use this video', 'godam' ),
					'select'      => __( 'Select video', 'godam' ),
					'replace'     => __( 'Replace', 'godam' ),
				),
			)
		);

		wp_register_style( 'rtgodam-learndash-admin', false, array(), RTGODAM_VERSION );
		wp_enqueue_style( 'rtgodam-learndash-admin' );
		wp_add_inline_style( 'rtgodam-learndash-admin', self::get_picker_css() );
	}

	/**
	 * Styles for the video picker, in the look of the editor's featured image panel.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	public static function get_picker_css(): string {
		return '.rtgodam-ld-video-picker [hidden]{display:none!important}'
			. '.rtgodam-ld-video-picker{max-width:320px}'
			. '.rtgodam-ld-video-picker__preview:empty{display:none}'
			. '.rtgodam-ld-video-picker__preview video{display:block;width:100%;aspect-ratio:16/9;background:#000;border-radius:4px}'
			. '.rtgodam-ld-video-picker__title{margin:8px 0 0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
			. '.rtgodam-ld-video-picker__actions{display:flex;gap:8px;align-items:center;margin-top:8px}'
			. '.rtgodam-ld-video-picker:not(.is-picked) .rtgodam-ld-video-picker__actions{margin-top:0}'
			. '.rtgodam-ld-video-picker .rtgodam-ld-video-picker__remove.button{color:#b32d2e;border-color:#b32d2e}'
			. '.rtgodam-ld-video-picker .rtgodam-ld-video-picker__remove.button:hover,'
			. '.rtgodam-ld-video-picker .rtgodam-ld-video-picker__remove.button:focus{color:#8a2424;border-color:#8a2424;background:#fcf0f1;box-shadow:none}';
	}

	/**
	 * Get the first GoDAM Video block in a post's content.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $post_id Post ID.
	 *
	 * @return array|null The parsed block, or null when there is none.
	 */
	private function get_video_block( int $post_id ) {
		if ( ! array_key_exists( $post_id, $this->video_blocks ) ) {
			$post = get_post( $post_id ); // godam-coverage-ignore -- $post_id is the LearnDash lesson or topic being shown; reads its own post_content, not attachment data.

			$this->video_blocks[ $post_id ] = ( $post && has_block( self::VIDEO_BLOCK, $post ) )
				? self::find_video_block( parse_blocks( $post->post_content ) )
				: null;
		}

		return $this->video_blocks[ $post_id ];
	}

	/**
	 * Get the lesson or topic being shown, when it uses the GoDAM Video block for progression.
	 *
	 * That is "Use GoDAM Video" on with no video picked in the settings.
	 *
	 * @since n.e.x.t
	 *
	 * @return int Post ID, or 0.
	 */
	private function get_block_progression_post_id(): int {
		$post = get_post(); // godam-coverage-ignore -- the current post, checked to be a LearnDash lesson or topic; never an attachment.
		if ( ! $post || ! in_array( $post->post_type, self::POST_TYPES, true ) || ! function_exists( 'learndash_get_setting' ) ) {
			return 0;
		}

		$settings = learndash_get_setting( $post );
		if ( ! is_array( $settings ) || 'on' !== ( $settings['lesson_video_enabled'] ?? '' ) || 0 !== self::get_marker_video_id( $settings['lesson_video_url'] ?? '' ) ) {
			return 0;
		}

		return (int) $post->ID;
	}

	/**
	 * Build the parsed GoDAM Video block that plays a picked attachment.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $video_id Attachment ID.
	 *
	 * @return array
	 */
	public static function build_video_block( int $video_id ): array {
		return array(
			'blockName'    => self::VIDEO_BLOCK,
			'attrs'        => array( 'id' => $video_id ),
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		);
	}

	/**
	 * Send GoDAM sources down LearnDash's `local` video path.
	 *
	 * The marker counts only when there is a video to finish: the picked one,
	 * while it is still a video, or else a GoDAM Video block in the content.
	 * Without one, returning no provider keeps Mark Complete usable.
	 *
	 * @since n.e.x.t
	 *
	 * @param string|false $provider Provider LearnDash found, or an empty value.
	 * @param array        $settings Lesson or topic settings.
	 *
	 * @return string|false
	 */
	public function filter_video_provider( $provider, $settings ) {
		$video_url = is_array( $settings ) ? ( $settings['lesson_video_url'] ?? '' ) : '';
		$video_id  = self::get_marker_video_id( $video_url );

		if ( null !== $video_id && $video_id > 0 ) {
			return static::is_picked_video( $video_id ) ? 'local' : false;
		}

		if ( 0 === $video_id ) {
			$post_id = $this->get_block_progression_post_id();

			return ( $post_id && $this->get_video_block( $post_id ) ) ? 'local' : false;
		}

		if ( empty( $provider ) && self::is_godam_url( $video_url ) ) {
			return 'local';
		}

		return $provider;
	}

	/**
	 * Render the `[video_godam]` shortcode for LearnDash.
	 *
	 * With an `id`, it plays that video in the GoDAM player. Without one it
	 * renders the GoDAM Video block of the lesson or topic being shown, when
	 * that lesson uses the block for progression.
	 *
	 * @since n.e.x.t
	 *
	 * @param array|string $atts Shortcode attributes.
	 *
	 * @return string
	 */
	public function render_block_shortcode( $atts = array() ) {
		$video_id = is_array( $atts ) && isset( $atts['id'] ) ? absint( $atts['id'] ) : 0;

		if ( $video_id > 0 ) {
			return static::is_picked_video( $video_id ) ? render_block( self::build_video_block( $video_id ) ) : '';
		}

		$post_id = $this->get_block_progression_post_id();
		$block   = $post_id ? $this->get_video_block( $post_id ) : null;

		if ( ! $block ) {
			return '';
		}

		$this->rendering_for_learndash = true;
		$output                        = render_block( $block );
		$this->rendering_for_learndash = false;

		return $output;
	}

	/**
	 * Render the GoDAM embed where LearnDash wraps a GoDAM URL in `[video]`.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $html Output so far; empty lets WordPress render the shortcode.
	 * @param array  $attr Shortcode attributes.
	 *
	 * @return string
	 */
	public function render_video_shortcode( $html, $attr ) {
		if ( '' !== $html || ! is_array( $attr ) ) {
			return $html;
		}

		$src = isset( $attr['src'] ) && is_string( $attr['src'] ) ? $attr['src'] : '';
		if ( '' === $src || ! self::is_godam_url( $src ) ) {
			return $html;
		}

		$embed = wp_oembed_get( $src );
		if ( is_string( $embed ) && '' !== $embed ) {
			return $embed;
		}

		// GoDAM's oEmbed API does not answer for every video; the embed page still works.
		return self::build_embed_iframe( $src );
	}

	/**
	 * Build the GoDAM embed iframe for a GoDAM video or embed URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url GoDAM URL, `/web/video/<id>` or `/web/embed/<id>`.
	 *
	 * @return string The iframe, or '' for any other URL.
	 */
	public static function build_embed_iframe( string $url ): string {
		if ( ! self::is_godam_url( $url ) ) {
			return '';
		}

		$path = wp_parse_url( $url, PHP_URL_PATH );
		if ( ! is_string( $path ) || ! preg_match( '#^/web/(?:video|embed)/([A-Za-z0-9_-]+)/?$#', $path, $matches ) ) {
			return '';
		}

		$embed_url = untrailingslashit( RTGODAM_API_BASE ) . '/web/embed/' . $matches[1];

		return sprintf(
			'<div class="rtgodam-ld-embed" style="position:relative;aspect-ratio:16/9;"><iframe src="%s" style="position:absolute;inset:0;width:100%%;height:100%%;border:0;" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>',
			esc_url( $embed_url )
		);
	}

	/**
	 * Rename the provider of a GoDAM video to PROVIDER.
	 *
	 * LearnDash applies this filter right before it writes the `.ld-video`
	 * wrapper and, in the footer, the `learndash_video_data` script object.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $video_data Video data LearnDash passes to its script.
	 * @param array $settings   Lesson or topic settings.
	 *
	 * @return array
	 */
	public function filter_video_data( $video_data, $settings ) {
		if (
			! is_array( $video_data )
			|| 'local' !== ( $video_data['videos_found_provider'] ?? '' )
			|| ! is_array( $settings )
			|| ! self::is_godam_source( $settings['lesson_video_url'] ?? '' )
		) {
			return $video_data;
		}

		$video_data['videos_found_provider'] = self::PROVIDER;
		$video_data['rtgodam_player']        = self::get_player_settings( $settings );
		$this->has_godam_video               = true;

		return $video_data;
	}

	/**
	 * Read the player settings of a lesson or topic for the GoDAM player.
	 *
	 * LearnDash fills its own copies in the video data only while it applies
	 * progression, so admins and learners on a completed step would not get
	 * them. The GoDAM player follows these every time it shows.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $settings Lesson or topic settings.
	 *
	 * @return array<string, bool>
	 */
	public static function get_player_settings( array $settings ): array {
		return array(
			'auto_start'    => 'on' === ( $settings['lesson_video_auto_start'] ?? '' ),
			'show_controls' => 'on' === ( $settings['lesson_video_show_controls'] ?? '' ),
			'focus_pause'   => 'on' === ( $settings['lesson_video_focus_pause'] ?? '' ),
			'track_time'    => 'on' === ( $settings['lesson_video_track_time'] ?? '' ),
		);
	}

	/**
	 * Keep the progression GoDAM Video block out of the content.
	 *
	 * LearnDash shows it instead: before or after the content, at [ld_video],
	 * or not at all while Display Timing hides it.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $block_content Rendered block.
	 * @param array  $block         Parsed block.
	 *
	 * @return string
	 */
	public function maybe_hide_video_block( $block_content, $block ) {
		if ( $this->rendering_for_learndash || ! is_array( $block ) ) {
			return $block_content;
		}

		$post_id = $this->get_block_progression_post_id();
		if ( ! $post_id ) {
			return $block_content;
		}

		$video_block = $this->get_video_block( $post_id );
		if ( ! $video_block || ( $video_block['attrs'] ?? array() ) !== ( $block['attrs'] ?? array() ) ) {
			return $block_content;
		}

		return '';
	}

	/**
	 * Load the script that connects GoDAM videos to LearnDash's video progress.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function enqueue_frontend_script() {
		if ( ! $this->has_godam_video || ! wp_script_is( 'learndash_video_script_js', 'enqueued' ) ) {
			return;
		}

		$asset = RTGODAM_PATH . 'assets/build/js/godam-learndash.min.js';
		if ( ! file_exists( $asset ) ) {
			return;
		}

		if ( ! wp_script_is( 'rtgodam-player-sdk', 'registered' ) ) {
			wp_register_script(
				'rtgodam-player-sdk',
				RTGODAM_URL . 'assets/build/js/godam-player-sdk.min.js',
				array(),
				filemtime( RTGODAM_PATH . 'assets/build/js/godam-player-sdk.min.js' ),
				true
			);
		}

		wp_enqueue_script(
			'rtgodam-learndash',
			RTGODAM_URL . 'assets/build/js/godam-learndash.min.js',
			array( 'jquery', 'learndash_video_script_js', 'rtgodam-player-sdk' ),
			filemtime( $asset ),
			true
		);

		wp_localize_script(
			'rtgodam-learndash',
			'rtgodamLearnDash',
			array(
				'provider'  => self::PROVIDER,
				'apiOrigin' => untrailingslashit( RTGODAM_API_BASE ),
			)
		);

		// LearnDash hides its own player's controls with CSS too; this keeps the big play button.
		wp_register_style( 'rtgodam-learndash', false, array(), RTGODAM_VERSION );
		wp_enqueue_style( 'rtgodam-learndash' );
		wp_add_inline_style( 'rtgodam-learndash', '.ld-video.rtgodam-ld-no-controls .vjs-control-bar{display:none!important}' );
	}
}
