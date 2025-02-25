<?php
/**
 * Handle progress calculation and display of progress bar.
 *
 * @since   1.0.0
 *
 * @package    Transcoder
 * @subpackage Transcoder/Admin
 */

/**
 * Handle progress calculation and display of progress bar.
 *
 * @since   1.0.0
 *
 * @package    Transcoder
 * @subpackage Transcoder/Admin
 */
class RT_Progress {

	/**
	 * Constructor
	 *
	 * @since   1.0.0
	 *
	 * @access public
	 * @return void
	 */
	public function __construct() {
	}

	/**
	 * Show progress_ui.
	 *
	 * @access public
	 *
	 * @since   1.0.0
	 *
	 * @param  float $progress  Progress value.
	 * @param  bool  $echo      If true then echo the output else return.
	 *
	 * @return string $progress_ui  Output of progress bar.
	 */
	public function progress_ui( $progress, $echo = true ) {

		$progress_ui = '
			<div id="rttprogressbar">
				<div style="width:' . esc_attr( $progress ) . '%"></div>
			</div>
			';

		if ( $echo ) {
			echo wp_kses(
				$progress_ui,
				array(
					'div' => array(
						'id'    => array(),
						'style' => array(),
					),
				)
			);
		} else {
			return $progress_ui;
		}
	}

	/**
	 * Calculate progress %.
	 *
	 * @access public
	 *
	 * @since   1.0.0
	 *
	 * @param  float $progress  Progress value.
	 * @param  float $total     Total value.
	 *
	 * @return float
	 */
	public function progress( $progress, $total ) {
		if ( $total < 1 ) {
			return 100;
		}

		return ( $progress / $total ) * 100;
	}
}
