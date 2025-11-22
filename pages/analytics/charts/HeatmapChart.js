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
 * Heatmap Visualization Class
 */
class HeatmapChart {
	/**
	 * @param {Array}  data        - Heatmap data array
	 * @param {string} selector    - SVG selector
	 * @param {Object} videoPlayer - VideoJS player instance
	 */
	constructor( data, selector, videoPlayer ) {
		this.data = data;
		this.selector = selector;
		this.videoPlayer = videoPlayer;
		this.config = {
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
			width: 830,
			height: 60,
		};

		this.initializeChart();
	}

	/**
	 * Initialize the heatmap chart
	 */
	initializeChart() {
		const { margin, width, height } = this.config;
		const chartWidth = width - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		this.svg = d3.select( this.selector )
			.attr( 'width', width )
			.attr( 'height', height )
			.append( 'g' )
			.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

		this.setupScales( chartWidth, chartHeight );
		this.renderHeatmap( chartWidth, chartHeight );
		this.setupInteractions( chartWidth, chartHeight );
	}

	/**
	 * Setup D3 scales for the heatmap
	 *
	 * @param {number} width  - Chart width
	 * @param {number} height - Chart height
	 */
	setupScales( width, height ) {
		// height is not used in this heatmap, but kept for consistency -- and eslint.
		void height;

		this.xScale = d3.scaleBand()
			.domain( d3.range( this.data.length ) )
			.range( [ 0, width ] )
			.padding( 0 );

		this.colorScale = d3.scaleSequential( d3.interpolateReds )
			.domain( [ 0, d3.max( this.data ) ] );
	}

	/**
	 * Render heatmap rectangles
	 *
	 * @param {number} width  - Chart width
	 * @param {number} height - Chart height
	 */
	renderHeatmap( width, height ) {
		this.svg.selectAll( 'rect.heatmap-rect' )
			.data( this.data )
			.enter()
			.append( 'rect' )
			.attr( 'class', 'heatmap-rect' )
			.attr( 'x', ( d, i ) => this.xScale( i ) )
			.attr( 'y', 0 )
			.attr( 'width', this.xScale.bandwidth() )
			.attr( 'height', height )
			.attr( 'fill', ( d ) => this.colorScale( d ) );

		this.verticalLine = this.svg.append( 'line' )
			.attr( 'class', 'heatmap-vertical-line' )
			.attr( 'y1', 0 )
			.attr( 'y2', height )
			.style( 'opacity', 0 );

		this.tooltip = d3.select( '.heatmap-tooltip' );
	}

	/**
	 * Setup mouse interactions for the heatmap
	 *
	 * @param {number} width  - Chart width
	 * @param {number} height - Chart height
	 */
	setupInteractions( width, height ) {
		const overlay = this.svg.append( 'rect' )
			.attr( 'width', width )
			.attr( 'height', height )
			.style( 'fill', 'none' )
			.style( 'pointer-events', 'all' );

		overlay.on( 'mousemove', ( event ) => this.handleMouseMove( event ) )
			.on( 'mouseout', () => this.handleMouseOut() );
	}

	/**
	 * Handle mouse move events
	 *
	 * @param {Event} event - Mouse event
	 */
	handleMouseMove( event ) {
		const [ mouseX ] = d3.pointer( event );
		const index = Math.floor( mouseX / this.xScale.step() );

		if ( index >= 0 && index < this.data.length ) {
			const value = this.data[ index ];
			const videoDuration = this.videoPlayer.duration();
			const videoTime = ( index / this.data.length ) * videoDuration;

			this.updateTooltip( index, value );
			this.updateVerticalLine( index );
			this.videoPlayer.currentTime( videoTime );
		}
	}

	/**
	 * Update tooltip content and position
	 *
	 * @param {number} index - Data index
	 * @param {number} value - Data value
	 */
	updateTooltip( index, value ) {
		const tooltipContent = `
			<div class="heatmap-tooltip-html">
				<div class="flex gap-2 items-center text-black">
					<img src="${ ViewIcon }" alt="${ __( 'View', 'godam' ) }" height="16" width="16"/>
					${ value }
				</div>
				<div class="flex gap-2 items-center text-black">
					<img src="${ DurationIcon }" alt="${ __( 'Duration', 'godam' ) }" height="15" width="15"/>
					${ formatTime( index ) }
				</div>
			</div>
		`;

		this.tooltip
			.style( 'opacity', 1 )
			.style( 'left', `${ this.xScale( index ) - 20 }px` )
			.style( 'top', `${ this.config.margin.top - 52 }px` )
			.html( tooltipContent );
	}

	/**
	 * Update vertical line position
	 *
	 * @param {number} index - Data index
	 */
	updateVerticalLine( index ) {
		const xPosition = this.xScale( index ) + ( this.xScale.bandwidth() / 2 );
		this.verticalLine
			.style( 'opacity', 1 )
			.attr( 'x1', xPosition )
			.attr( 'x2', xPosition );
	}

	/**
	 * Handle mouse out events
	 */
	handleMouseOut() {
		this.tooltip.style( 'opacity', 0 );
		this.verticalLine.style( 'opacity', 0 );
	}
}

export default HeatmapChart;
