<?php
/**
 * LifterLMS Advanced Videos Integration Class for GoDAM
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Lifter_LMS;

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'LLMS_AV_Abstract_Integration' ) ) {

	// phpcs:disable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase

	/**
	 * Class LLMS_AV_Integration_GoDAM
	 *
	 * @since n.e.x.t
	 *
	 * @package GoDAM
	 */
	class LLMS_AV_Integration_GoDAM extends \LLMS_AV_Abstract_Integration {

		/**
		 * Integration ID.
		 *
		 * @since n.e.x.t
		 *
		 * @var string
		 */
		public $id = 'av_godam';

		/**
		 * Integration title.
		 *
		 * @since n.e.x.t
		 *
		 * @var string
		 */
		public $title = 'GoDAM';

		/**
		 * Integration Description.
		 *
		 * @since n.e.x.t
		 *
		 * @var string
		 */
		public $description = '';

		/**
		 * Whether or not to load wpColorPicker assets on the settings screen.
		 *
		 * @since n.e.x.t
		 *
		 * @var bool
		 */
		protected $load_colorpicker = false;

		/**
		 * Player SDK source.
		 *
		 * @since n.e.x.t
		 *
		 * @var string
		 */
		protected $player_sdk_src = false;

		/**
		 * Integration Priority.
		 *
		 * @since n.e.x.t
		 *
		 * @var int
		 */
		protected $priority = 50;

		/**
		 * Regex to identify videos from the provider.
		 *
		 * @since n.e.x.t
		 *
		 * @var string
		 */
		protected $regex = '#src="(' . RTGODAM_API_BASE . '/web/embed/[^"]+)"#i';

		/**
		 * Regex to identify a URL that's parseable oEmbed URL for the provider.
		 *
		 * @since n.e.x.t
		 *
		 * @var string
		 */
		protected $regex_oembed = '#' . RTGODAM_API_BASE . '/web/video/[^"\s]+#i';

		/**
		 * Integration Constructor.
		 *
		 * @since n.e.x.t
		 */
		protected function configure() {

			add_action( 'init', array( $this, 'set_title_and_description' ) );

			parent::configure();
		}

		/**
		 * Set the integration title and description.
		 *
		 * @since n.e.x.t
		 */
		public function set_title_and_description() {
			$this->title       = __( 'Videos: GoDAM', 'godam' );
			$this->description = __( 'Advanced LifterLMS lesson video features for GoDAM videos.', 'godam' );
		}

		/**
		 * Determines if player controls are hidden for the given lesson video.
		 *
		 * @param int $lesson_id WP_Post ID of a lesson.
		 *
		 * @since n.e.x.t
		 *
		 * @return bool
		 */
		protected function are_player_controls_hidden( $lesson_id ) {

			return llms_parse_bool( $this->get_cascading_option( 'player_disable_controls', $lesson_id ) );
		}

		/**
		 * Get an array of player settings for a given object.
		 * Parent class had abstract method, so this is required.
		 *
		 * This should return an array of settings that will be converted to query string variables
		 * which can be interpreted by the player's JS API when added to the player's iframe embed src.
		 *
		 * @since n.e.x.t
		 *
		 * @param int $object_id WP_Post ID.
		 *
		 * @return array
		 */
		protected function get_player_settings( $object_id = null ) {
			return array();
		}

		/**
		 * Retrieves the player theme color for the given lesson video.
		 * Parent class had abstract method, so this is required.
		 *
		 * @since n.e.x.t
		 *
		 * @param int $lesson_id WP_Post ID of a lesson.
		 *
		 * @return string Hexcode of the player theme color (with leading '#').
		 */
		public function get_player_theme_color( $lesson_id ) {

			$color = $this->get_option( 'player_color', '#00adef' );

			/**
			 * Filter the player theme color for a given lesson.
			 */
			return apply_filters( 'llms_av_godam_get_player_theme_color', $color, $lesson_id );
		}
	}

	// phpcs:enable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase

}
