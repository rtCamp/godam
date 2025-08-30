/* global d3 */
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import ViewIcon from '../../../assets/src/images/views.svg';
import DurationIcon from '../../../assets/src/images/duration.svg';

import {
	formatTime,
} from '../utils';

/**
 * Line Chart with Hover and Tooltip
 */
class VideoLineChart {
	/**
	 * @param {Array}  data            - Array of numerical data points
	 * @param {string} selector        - Container selector for the chart
	 * @param {Object} videoPlayer     - Video.js player instance
	 * @param {Object} config          - Configuration object for the chart
	 * @param {string} tooltipSelector - Selector for the tooltip element
	 */
	constructor( data, selector, videoPlayer, config = {}, tooltipSelector = '.line-chart-tooltip' ) {
		this.data = data;
		this.selector = selector;
		this.videoPlayer = videoPlayer;
		this.config = config;
		this.tooltipSelector = tooltipSelector;

		this.initializeChart();
	}

	/**
	 * Setup and render chart
	 */
	initializeChart() {
		this.setupDimensions();
		this.createSVG();
		this.setupScales();
		this.setupGenerators();
		this.renderLineAndArea();
		this.setupTooltipElements();
		this.addHoverListener();
	}

	setupDimensions() {
		const { width, height, margin } = this.config;

		this.innerWidth = width - margin.left - margin.right;
		this.innerHeight = height - margin.top - margin.bottom;
	}

	createSVG() {
		const { width, height, margin } = this.config;

		this.svg = d3
			.select( this.selector )
			.attr( 'width', width )
			.attr( 'height', height )
			.append( 'g' )
			.attr( 'transform', `translate(${ margin.left },${ margin.top })` );
	}

	setupScales() {
		this.xScale = d3
			.scaleLinear()
			.domain( [ 0, this.data.length - 1 ] )
			.range( [ 0, this.innerWidth ] );

		this.yScale = d3
			.scaleLinear()
			.domain( [ d3.min( this.data ) - 10, d3.max( this.data ) + 10 ] )
			.range( [ this.innerHeight, 0 ] );
	}

	setupGenerators() {
		this.lineGenerator = d3
			.line()
			.x( ( d, i ) => this.xScale( i ) )
			.y( ( d ) => this.yScale( d ) );

		this.areaGenerator = d3
			.area()
			.x( ( d, i ) => this.xScale( i ) )
			.y0( this.innerHeight )
			.y1( ( d ) => this.yScale( d ) );
	}

	renderLineAndArea() {
		this.svg
			.append( 'path' )
			.datum( this.data )
			.attr( 'class', 'line' )
			.attr( 'd', this.lineGenerator );
	}

	setupTooltipElements() {
		this.hoverLine = this.svg
			.append( 'line' )
			.attr( 'class', 'hover-line' )
			.attr( 'y1', 0 )
			.attr( 'y2', this.innerHeight )
			.style( 'opacity', 0 );

		this.focusCircle = this.svg
			.append( 'circle' )
			.attr( 'class', 'focus-circle' )
			.style( 'opacity', 0 );

		this.filledArea = this.svg
			.append( 'path' )
			.datum( this.data )
			.attr( 'class', 'area' )
			.style( 'opacity', 0 );

		this.tooltip = d3.select( this.tooltipSelector );
	}

	addHoverListener() {
		this.svg
			.append( 'rect' )
			.attr( 'width', this.innerWidth )
			.attr( 'height', this.innerHeight )
			.style( 'fill', 'none' )
			.style( 'pointer-events', 'all' )
			.on( 'mousemove', ( event ) => this.handleMouseMove( event ) )
			.on( 'mouseout', () => this.handleMouseOut() );
	}

	/**
	 * Handle mouse move and update UI
	 *
	 * @param {Event} event - Mouse event
	 */
	handleMouseMove( event ) {
		const [ mouseX ] = d3.pointer( event );
		const xValue = this.xScale.invert( mouseX );
		const index = Math.round( xValue );

		if ( index < 0 || index >= this.data.length ) {
			return;
		}

		const value = this.data[ index ];
		const duration = this.videoPlayer.duration();
		const videoTime = ( index / this.data.length ) * duration;

		if ( isNaN( videoTime ) || ! isFinite( videoTime ) ) {
			return;
		}

		this.focusCircle
			.style( 'opacity', 1 )
			.attr( 'cx', this.xScale( index ) )
			.attr( 'cy', this.yScale( value ) );

		this.hoverLine
			.style( 'opacity', 1 )
			.attr( 'x1', this.xScale( index ) )
			.attr( 'x2', this.xScale( index ) );

		this.tooltip
			.style( 'opacity', 1 )
			.style( 'left', `${ this.xScale( index ) - 30 }px` )
			.style( 'top', 0 )
			.html(
				`<div class="heatmap-tooltip-html">
					<div class="flex gap-2 items-center text-black">
						<img src=${ ViewIcon } alt="${ __( 'View', 'godam' ) }" height=16 width=16 />
						${ value }
					</div>
					<div class="flex gap-2 items-center text-black">
						<img src=${ DurationIcon } alt="${ __( 'Duration', 'godam' ) }" height=15 width=15 />
						${ formatTime( index ) }
					</div>
				</div>`,
			);

		this.videoPlayer.currentTime( videoTime );

		this.filledArea
			.style( 'opacity', 1 )
			.attr( 'd', this.areaGenerator( this.data.slice( 0, index + 1 ) ) );
	}

	/**
	 * Handle mouse out of chart area
	 */
	handleMouseOut() {
		this.focusCircle.style( 'opacity', 0 );
		this.hoverLine.style( 'opacity', 0 );
		this.tooltip.style( 'opacity', 0 );
		this.filledArea.style( 'opacity', 0 );
	}
}

export default VideoLineChart;
