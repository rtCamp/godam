<?php
/**
 * Permalinks settings for GoDAM Video CPT slug.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Permalinks.
 */
class Video_Permalinks {

	use Singleton;

	/**
	 * Construct method.
	 * 
	 * @return void
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		// Add a section to the permalinks page.
		add_action( 'admin_init', array( $this, 'register_permalink_settings' ) );
		
		// Add fields to the permalinks page.
		add_action( 'admin_init', array( $this, 'add_permalink_fields' ) );
		
		// Save permalink settings.
		add_action( 'admin_init', array( $this, 'save_permalink_settings' ) );
	}

	/**
	 * Register permalink settings.
	 *
	 * @return void
	 */
	public function register_permalink_settings() {
		register_setting(
			'permalink',
			'rtgodam_video_slug',
			array(
				'type'              => 'string',
				'description'       => __( 'GoDAM Video slug', 'godam' ),
				'sanitize_callback' => 'sanitize_title',
				'default'           => 'videos',
			)
		);
	}

	/**
	 * Add permalink fields.
	 *
	 * @return void
	 */
	public function add_permalink_fields() {
		add_settings_section(
			'godam-permalink-settings',
			__( 'GoDAM Video Permalinks', 'godam' ),
			array( $this, 'permalink_settings_section' ),
			'permalink'
		);

		add_settings_field(
			'rtgodam_video_slug',
			__( 'Video archive URL slug', 'godam' ),
			array( $this, 'video_slug_field' ),
			'permalink',
			'godam-permalink-settings'
		);
	}

	/**
	 * Permalink settings section description.
	 *
	 * @return void
	 */
	public function permalink_settings_section() {
		echo '<p>' . esc_html__( 'These settings control the permalinks used for GoDAM video archives and pages.', 'godam' ) . '</p>';
	}

	/**
	 * Video slug field.
	 *
	 * @return void
	 */
	public function video_slug_field() {
		$value = get_option( 'rtgodam_video_slug', 'videos' );
		?>
		<input 
			type='text' 
			name='rtgodam_video_slug' 
			id='rtgodam_video_slug' 
			value='<?php echo esc_attr( $value ); ?>' 
			class='regular-text code'
		/>
		<p class='description'>
			<?php echo esc_html__( 'This slug will be used in the URL for video archive and single video pages (e.g., yoursite.com/videos/). Only lowercase letters, numbers, hyphens, and underscores are allowed.', 'godam' ); ?>
		</p>
		<?php
	}
	
	/**
	 * Save permalink settings.
	 *
	 * @return void
	 */
	public function save_permalink_settings() {
		// Only process on the permalinks settings page.
		if ( ! is_admin() || ! isset( $_POST['permalink_structure'] ) ) {
			return;
		}

		// User permission check.
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Nonce verification.
		if ( isset( $_POST['permalink_structure'] ) && isset( $_POST['_wpnonce'] ) && wp_verify_nonce( sanitize_key( $_POST['_wpnonce'] ), 'update-permalink' ) ) {
			
			// Save video slug if it exists in the POST data.
			if ( isset( $_POST['rtgodam_video_slug'] ) ) {
				$video_slug = sanitize_title( wp_unslash( $_POST['rtgodam_video_slug'] ) );
				
				// Get the old value to compare.
				$old_value = get_option( 'rtgodam_video_slug', 'videos' );
				
				// Only update if changed.
				if ( $old_value !== $video_slug ) {
					update_option( 'rtgodam_video_slug', $video_slug );
					
					// Flush rewrite rules to apply new video slug.
					flush_rewrite_rules();
				}
			}
		}
	}
}
