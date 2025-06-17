<?php
/**
 * To load all classes that register elementor widget.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Elementor_Widgets\Godam_Audio;
use RTGODAM\Inc\Elementor_Widgets\Godam_Gallery;
use RTGODAM\Inc\Elementor_Widgets\GoDAM_Player;
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
		$this->register_scripts();
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
	 * Register Widgets.
	 */
	public function widgets_registered() {
		\Elementor\Plugin::$instance->widgets_manager->register( new GoDAM_Player() );
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
