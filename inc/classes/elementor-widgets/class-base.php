<?php
/**
 * Abstract class to register Elementor Widget.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Elementor_Widgets;

use RTGODAM\Inc\Traits\Singleton;
use Elementor\Widget_Base;

/**
 * Base class to register GoDAM Elementor Widget.
 */
abstract class Base extends Widget_Base {

	use Singleton;

	/**
	 * Widget name/slug.
	 *
	 * @var string Widget name.
	 */
	protected $name;

	/**
	 * Widget Title.
	 *
	 * @var string Widget title.
	 */
	protected $title;

	/**
	 * Widget Icon.
	 *
	 * @var string Widget icon.
	 */
	protected $icon;

	/**
	 * Widget Category.
	 *
	 * @var array Widget Category.
	 */
	protected $categories;

	/**
	 * Widget keywords.
	 *
	 * @var array Widget keywords.
	 */
	protected $keywords;

	/**
	 * Script Dependencies.
	 *
	 * @var array script dependencies.
	 */
	protected $depended_script;

	/**
	 * Style Dependencies.
	 *
	 * @var array style dependencies.
	 */
	protected $depended_styles;

	/**
	 * Construct method.
	 *
	 * @param array      $data Widget data. Default is an empty array.
	 * @param array|null $args Optional. Widget default arguments. Default is null.
	 *
	 * @throws \Exception If arguments are missing when initializing a full widget instance.
	 */
	public function __construct( $data = array(), $args = null ) {

		$labels = $this->set_default_config();

		$this->name            = ( isset( $labels['name'] ) ) ? $labels['name'] : 'godam-widget-name';
		$this->title           = ( isset( $labels['title'] ) ) ? $labels['title'] : __( 'GoDAM Widget Title', 'godam' );
		$this->icon            = ( isset( $labels['icon'] ) ) ? $labels['icon'] : 'eicon-apps';
		$this->categories      = ( isset( $labels['categories'] ) ) ? $labels['categories'] : array( 'godam' );
		$this->keywords        = ( isset( $labels['keywords'] ) && is_array( $labels['keywords'] ) ) ? $labels['keywords'] : array();
		$this->depended_script = ( isset( $labels['depended_script'] ) && is_array( $labels['depended_script'] ) ) ? $labels['depended_script'] : array();
		$this->depended_styles = ( isset( $labels['depended_styles'] ) && is_array( $labels['depended_styles'] ) ) ? $labels['depended_styles'] : array();

		parent::__construct( $data, $args );
	}

	/**
	 * To get list of default arguments for Widget.
	 *
	 * @return array
	 */
	abstract public function set_default_config();

	/**
	 * Get element name.
	 *
	 * Retrieve the element name.
	 *
	 * @access public
	 *
	 * @return string The name.
	 */
	public function get_name() {
		return $this->name;
	}

	/**
	 * Get element title.
	 *
	 * Retrieve the element title.
	 *
	 * @access public
	 *
	 * @return string Element title.
	 */
	public function get_title() {
		return $this->title;
	}

	/**
	 * Get widget icon.
	 *
	 * Retrieve the widget icon.
	 *
	 * @access public
	 *
	 * @return string Widget icon.
	 */
	public function get_icon() {
		return $this->icon;
	}

	/**
	 * Get widget categories.
	 *
	 * Retrieve the widget categories.
	 *
	 * @access public
	 *
	 * @return array Widget categories.
	 */
	public function get_categories() {
		return $this->categories;
	}

	/**
	 * Get widget keywords.
	 *
	 * Retrieve the widget keywords.
	 *
	 * @access public
	 *
	 * @return array Widget keywords.
	 */
	public function get_keywords() {
		return $this->keywords;
	}

	/**
	 * Get script dependencies.
	 *
	 * Retrieve the list of script dependencies the element requires.
	 *
	 * @access public
	 *
	 * @return array Element scripts dependencies.
	 */
	public function get_script_depends() {
		return $this->depended_script;
	}

	/**
	 * Get style dependencies.
	 *
	 * Retrieve the list of style dependencies the element requires.
	 *
	 * @access public
	 *
	 * @return array Element styles dependencies.
	 */
	public function get_style_depends() {
		return $this->depended_styles;
	}
}
