<?php
/**
 * Registers GoDAM's abilities with the WordPress Abilities API.
 *
 * An ability is a self-describing unit of work — name, input and output
 * schemas, a permission check and a callback — that any client can discover
 * and run: the REST API, the block editor, and AI agents through the MCP
 * Adapter plugin. GoDAM only registers abilities. Serving them over MCP is the
 * adapter's job, so nothing in this directory runs a server.
 *
 * The Abilities API ships in WordPress 6.9. On older sites this class does
 * nothing and GoDAM behaves exactly as before.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Abilities
 *
 * @since 2.8.0
 */
class Abilities {

	use Singleton;

	/**
	 * Option that exposes abilities which change data.
	 *
	 * Read abilities are exposed by default: they reveal nothing the user could
	 * not already see in wp-admin. Abilities that change data stay registered
	 * but unexposed until a site administrator turns this on.
	 *
	 * @since 2.8.0
	 *
	 * @var string
	 */
	const WRITE_ABILITIES_OPTION = 'rtgodam_expose_write_abilities';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		if ( ! function_exists( 'wp_register_ability' ) || ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}

		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_categories' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
		add_action( 'init', array( $this, 'register_setting' ) );
		add_action( 'admin_init', array( $this, 'add_settings_field' ) );

		Mcp_Server::get_instance();
	}

	/**
	 * Registers the write-abilities option as a setting.
	 *
	 * Registering it on `init` also exposes it to the `/wp/v2/settings` REST
	 * route, which only site administrators can use.
	 *
	 * @since 2.8.0
	 *
	 * @return void
	 */
	public function register_setting() {
		register_setting(
			'writing',
			self::WRITE_ABILITIES_OPTION,
			array(
				'type'              => 'boolean',
				'description'       => __( 'Let AI agents connected through MCP make changes in GoDAM.', 'godam' ),
				'sanitize_callback' => 'rest_sanitize_boolean',
				'default'           => false,
				'show_in_rest'      => true,
			)
		);
	}

	/**
	 * Adds the write-abilities checkbox to Settings › Writing.
	 *
	 * @since 2.8.0
	 *
	 * @return void
	 */
	public function add_settings_field() {
		add_settings_field(
			self::WRITE_ABILITIES_OPTION,
			__( 'GoDAM and AI agents', 'godam' ),
			array( $this, 'render_settings_field' ),
			'writing'
		);
	}

	/**
	 * Renders the write-abilities checkbox.
	 *
	 * @since 2.8.0
	 *
	 * @return void
	 */
	public function render_settings_field() {
		?>
		<label for="<?php echo esc_attr( self::WRITE_ABILITIES_OPTION ); ?>">
			<input type="checkbox" id="<?php echo esc_attr( self::WRITE_ABILITIES_OPTION ); ?>" name="<?php echo esc_attr( self::WRITE_ABILITIES_OPTION ); ?>" value="1" <?php checked( (bool) get_option( self::WRITE_ABILITIES_OPTION, false ) ); ?> />
			<?php esc_html_e( 'Let AI agents connected through MCP make changes: create folders, import media, edit layers and chapters, add media to pages, change player settings and more.', 'godam' ); ?>
		</label>
		<p class="description"><?php esc_html_e( 'Agents can always read the library. Each change is still limited to what the connected user is allowed to do.', 'godam' ); ?></p>
		<?php
	}

	/**
	 * Registers the categories GoDAM's abilities are grouped under.
	 *
	 * Categories register on their own hook, which fires before
	 * `wp_abilities_api_init`; an ability naming an unregistered category is
	 * rejected.
	 *
	 * @since 2.8.0
	 *
	 * @return void
	 */
	public function register_categories() {
		wp_register_ability_category(
			'godam-media',
			array(
				'label'       => __( 'GoDAM media', 'godam' ),
				'description' => __( 'Find and inspect media in the GoDAM library, see where it is used, and read transcripts.', 'godam' ),
			)
		);

		wp_register_ability_category(
			'godam-library',
			array(
				'label'       => __( 'GoDAM library', 'godam' ),
				'description' => __( 'Organise the GoDAM library: folders and media details.', 'godam' ),
			)
		);

		wp_register_ability_category(
			'godam-player',
			array(
				'label'       => __( 'GoDAM player', 'godam' ),
				'description' => __( 'Interactive layers, chapters and per-video player settings, and placing GoDAM blocks on pages.', 'godam' ),
			)
		);

		wp_register_ability_category(
			'godam-settings',
			array(
				'label'       => __( 'GoDAM settings', 'godam' ),
				'description' => __( 'Site-wide GoDAM player settings.', 'godam' ),
			)
		);

		wp_register_ability_category(
			'godam-processing',
			array(
				'label'       => __( 'GoDAM processing', 'godam' ),
				'description' => __( 'Request transcoding and transcription from GoDAM.', 'godam' ),
			)
		);

		wp_register_ability_category(
			'godam-analytics',
			array(
				'label'       => __( 'GoDAM analytics', 'godam' ),
				'description' => __( 'Video performance, layer and store insights, and account usage.', 'godam' ),
			)
		);
	}

	/**
	 * Registers every GoDAM ability.
	 *
	 * @since 2.8.0
	 *
	 * @return void
	 */
	public function register_abilities() {
		$groups = array(
			Media_Abilities::class,
			Library_Abilities::class,
			Layer_Abilities::class,
			Form_Abilities::class,
			Chapter_Abilities::class,
			Video_Settings_Abilities::class,
			Block_Abilities::class,
			Site_Settings_Abilities::class,
			Processing_Abilities::class,
			Analytics_Abilities::class,
		);

		foreach ( $groups as $group ) {
			( new $group() )->register();
		}
	}
}
