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
 * @since n.e.x.t
 */
class Abilities {

	use Singleton;

	/**
	 * Option that exposes abilities which change data.
	 *
	 * On by default. Each change is still limited to what the connected
	 * WordPress user may do, and tools that overwrite data are flagged so MCP
	 * clients ask first. A site administrator can turn it off in
	 * Settings › Writing as a kill switch for every write.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const WRITE_ABILITIES_OPTION = 'rtgodam_expose_write_abilities';

	/**
	 * Option that turns the GoDAM MCP server on or off.
	 *
	 * On by default on every site, new or updated. An agent needs a WordPress
	 * user's Application Password, and can only do what that user's role
	 * allows. MCP clients also need the MCP Adapter plugin; without it the
	 * abilities are reachable only through the WordPress Abilities REST API.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const MCP_ENABLED_OPTION = 'rtgodam_mcp_enabled';

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
		Ai_Agents_Notice::get_instance();
	}

	/**
	 * Whether abilities that change data are exposed.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public static function writes_enabled() {
		return (bool) get_option( self::WRITE_ABILITIES_OPTION, true );
	}

	/**
	 * Whether the GoDAM MCP server is on.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public static function mcp_enabled() {
		/**
		 * Filters whether the GoDAM MCP server is on.
		 *
		 * @since n.e.x.t
		 *
		 * @param bool $enabled Whether the server is on.
		 */
		return (bool) apply_filters( 'rtgodam_mcp_enabled', (bool) get_option( self::MCP_ENABLED_OPTION, true ) );
	}

	/**
	 * Stores a switch as 1 or 0.
	 *
	 * Core's rest_sanitize_boolean() alone stores false as an empty string,
	 * which the settings REST route then reports as an invalid stored value.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed $value Submitted value.
	 *
	 * @return int
	 */
	public static function sanitize_switch( $value ) {
		return rest_sanitize_boolean( $value ) ? 1 : 0;
	}

	/**
	 * Registers the write-abilities option as a setting.
	 *
	 * Registering it on `init` also exposes it to the `/wp/v2/settings` REST
	 * route, which only site administrators can use.
	 *
	 * @since n.e.x.t
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
				'sanitize_callback' => array( __CLASS__, 'sanitize_switch' ),
				'default'           => true,
				'show_in_rest'      => true,
			)
		);

		// Its own group, not 'general': WordPress sets every option of a core
		// settings page's group that the page's form does not send to null, so
		// saving Settings › General would turn the switch off.
		register_setting(
			'rtgodam_mcp',
			self::MCP_ENABLED_OPTION,
			array(
				'type'              => 'boolean',
				'description'       => __( 'Let AI agents use GoDAM through MCP. When off, GoDAM\'s tools are hidden from every MCP server and from the WordPress Abilities REST API.', 'godam' ),
				'sanitize_callback' => array( __CLASS__, 'sanitize_switch' ),
				'default'           => true,
				'show_in_rest'      => true,
			)
		);
	}

	/**
	 * Adds the write-abilities checkbox to Settings › Writing.
	 *
	 * @since n.e.x.t
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
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function render_settings_field() {
		?>
		<label for="<?php echo esc_attr( self::WRITE_ABILITIES_OPTION ); ?>">
			<input type="checkbox" id="<?php echo esc_attr( self::WRITE_ABILITIES_OPTION ); ?>" name="<?php echo esc_attr( self::WRITE_ABILITIES_OPTION ); ?>" value="1" <?php checked( self::writes_enabled() ); ?> />
			<?php esc_html_e( 'Let AI agents connected through MCP make changes: create folders, import media, edit layers and chapters, add media to pages, change player settings and more.', 'godam' ); ?>
		</label>
		<p class="description"><?php esc_html_e( 'On by default. Agents can always read the library. Each change is still limited to what the connected user is allowed to do. Turn this off to stop every change from AI agents.', 'godam' ); ?></p>
		<?php
	}

	/**
	 * Registers the categories GoDAM's abilities are grouped under.
	 *
	 * Categories register on their own hook, which fires before
	 * `wp_abilities_api_init`; an ability naming an unregistered category is
	 * rejected.
	 *
	 * @since n.e.x.t
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
	 * @since n.e.x.t
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
			Prompt_Abilities::class,
		);

		foreach ( $groups as $group ) {
			( new $group() )->register();
		}
	}
}
