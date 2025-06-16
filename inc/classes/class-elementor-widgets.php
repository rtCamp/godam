<?php
/**
 * To load all classes that register elementor widget.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Elementor_Widgets\Godam_Gallery;
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

		add_action( 'elementor/widgets/register', array( $this, 'widgets_registered' ) );
		add_action( 'elementor/elements/categories_registered', array( $this, 'add_elementor_widget_categories' ) );
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
		\Elementor\Plugin::$instance->widgets_manager->register( new Godam_Gallery() );
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
