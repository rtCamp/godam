<?php
/**
 * To load all classes that register elementor widget.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Elementor_Controls\Godam_Media;
use RTGODAM\Inc\Elementor_Widgets\Godam_Audio;
use RTGODAM\Inc\Elementor_Widgets\Godam_Gallery;
use RTGODAM\Inc\Elementor_Widgets\GoDAM_Video;
use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Elementor Widgets.
 */
class Elementor_Widgets {
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
	public function setup_hooks() {
		/**
		 * Actions.
		 */
		add_action( 'elementor/widgets/register', array( $this, 'widgets_registered' ) );
		add_action( 'elementor/elements/categories_registered', array( $this, 'add_elementor_widget_categories' ) );
		add_action( 'elementor/controls/controls_registered', array( $this, 'widgets_controls' ) );
		add_action( 'elementor/editor/before_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_scripts' ) );
	}

	/**
	 * Scripts for elementor frontend rendering.
	 * 
	 * @return void
	 */
	public function enqueue_scripts() {
		/**
		 * The below script is only required in elementor editor experience.
		 */
		wp_enqueue_script( 'godam-elementor-frontend' );
	}

	/**
	 * Registers required scripts and styles.
	 *
	 * @return void
	 */
	public function register_scripts() {

		/**
		 * Styles.
		 */
		wp_register_style(
			'elementor-godam-audio-style',
			RTGODAM_URL . 'assets/build/css/godam-audio.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-audio.css' )
		);
		

		wp_register_script(
			'godam-elementor-frontend',
			RTGODAM_URL . 'assets/build/js/godam-elementor-frontend.min.js',
			array(
				'jquery',
				'wp-i18n',
				'godam-player-frontend-script',
			),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-elementor-frontend.min.js' ),
			true
		);
	}

	/**
	 * Get the available menus.
	 *
	 * @access private
	 * @return array
	 */
	public function get_available_menus() {
		$menus = wp_get_nav_menus();

		$options = array(
			'none' => 'None',
		);

		foreach ( $menus as $menu ) {
			$options[ $menu->slug ] = $menu->name;
		}

		return $options;
	}

	/**
	 * Register Controls.
	 */
	public function widgets_controls() {
		\Elementor\Plugin::$instance->controls_manager->register( new Godam_Media(), 'godam-media' );
	}

	/**
	 * Register Widgets.
	 */
	public function widgets_registered() {
		\Elementor\Plugin::$instance->widgets_manager->register( new GoDAM_Video() );
		\Elementor\Plugin::$instance->widgets_manager->register( new Godam_Gallery() );
		\Elementor\Plugin::$instance->widgets_manager->register( new Godam_Audio() );
	}

	/**
	 * Add custom category.
	 *
	 * @param object $elements_manager Elements Manager Object.
	 */
	public function add_elementor_widget_categories( $elements_manager ) {

		$elements_manager->add_category(
			'godam',
			array(
				'title' => __( 'GoDAM', 'godam' ),
				'icon'  => 'fa fa-plug',
			)
		);
	}
}
