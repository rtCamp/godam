/* global d3 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	formatNumber,
} from '../utils';

/**
 * Post Views Donut Chart Class
 */
class PostViewsChart {
	/**
	 * @param {Array}  data     - Posts data array
	 * @param {string} selector - Container selector
	 */
	constructor( data, selector ) {
		this.data = data;
		this.selector = selector;
		this.config = {
			width: 200,
			height: 200,
			margin: 20,
			innerRadiusRatio: 0.7,
			hoverScale: 1.05,
		};

		this.initializeChart();
	}

	/**
	 * Initialize the donut chart
	 */
	initializeChart() {
		const { width, height, margin, innerRadiusRatio } = this.config;
		this.radius = ( Math.min( width, height ) / 2 ) - margin;
		this.innerRadius = this.radius * innerRadiusRatio;
		this.totalViews = this.data.reduce( ( sum, entry ) => sum + entry.views, 0 );

		this.setupColorScale();
		this.createSVG();
		this.createTooltip();
		this.setupGenerators();
		this.renderChart();
		this.addCenterText();
		this.createLegend();
	}

	/**
	 * Setup color scale for the chart
	 */
	setupColorScale() {
		this.colorScale = d3.scaleOrdinal()
			.domain( this.data.map( ( d ) => d.post + d.id ) )
			.range( [
				'#1D4A4F', '#368071', '#4C9A88', '#5DB5A1',
				'#76CFC0', '#A8E4D7', '#D1F0EC', '#2C6660',
			] );
	}

	/**
	 * Create SVG container
	 */
	createSVG() {
		const { width, height } = this.config;
		this.svg = d3.select( this.selector )
			.append( 'svg' )
			.attr( 'width', width )
			.attr( 'height', height )
			.append( 'g' )
			.attr( 'transform', `translate(${ width / 2 }, ${ height / 2 })` );
	}

	/**
	 * Create tooltip element
	 */
	createTooltip() {
		this.tooltip = d3.select( 'body' )
			.append( 'div' )
			.attr( 'class', 'tooltip' )
			.style( 'opacity', 0 );
	}

	/**
	 * Setup D3 pie and arc generators
	 */
	setupGenerators() {
		this.pie = d3.pie()
			.value( ( d ) => d.views )
			.sort( null );

		this.arc = d3.arc()
			.innerRadius( this.innerRadius )
			.outerRadius( this.radius );

		this.arcHover = d3.arc()
			.innerRadius( this.innerRadius )
			.outerRadius( this.radius * this.config.hoverScale );
	}

	/**
	 * Render the donut chart
	 */
	renderChart() {
		const arcs = this.svg.selectAll( 'a' )
			.data( this.pie( this.data ) )
			.enter()
			.append( 'a' )
			.attr( 'xlink:href', ( d ) => d.data.url )
			.attr( 'target', '_blank' );

		arcs.append( 'path' )
			.attr( 'd', this.arc )
			.attr( 'fill', ( d ) => this.colorScale( d.data.post + d.data.id ) )
			.attr( 'stroke', 'white' )
			.style( 'stroke-width', '2px' )
			.on( 'mouseover', ( event, d ) => this.handleMouseOver( event, d ) )
			.on( 'mouseout', ( event, d ) => this.handleMouseOut( event, d ) );

		this.addSliceLabels();
	}

	/**
	 * Add view count labels to chart slices
	 */
	addSliceLabels() {
		this.svg.selectAll( 'text.slice-label' )
			.data( this.pie( this.data ) )
			.enter()
			.append( 'text' )
			.attr( 'class', 'slice-label' )
			.attr( 'transform', ( d ) => `translate(${ this.arc.centroid( d ) })` )
			.attr( 'text-anchor', 'middle' )
			.attr( 'dy', '0.35em' )
			.style( 'fill', '#fff' )
			.style( 'font-size', '11px' )
			.style( 'font-weight', 'bold' )
			.text( ( d ) => formatNumber( d.data.views ) );
	}

	/**
	 * Add center text displaying total views
	 */
	addCenterText() {
		this.svg.append( 'text' )
			.attr( 'class', 'center-text-title' )
			.attr( 'dy', -10 )
			.text( 'Total' );

		this.svg.append( 'text' )
			.attr( 'class', 'center-text-views' )
			.attr( 'dy', 20 )
			.text( formatNumber( this.totalViews ) );
	}

	/**
	 * Create legend for the chart
	 */
	createLegend() {
		const legend = d3.select( '#legend' );

		this.data.forEach( ( d ) => {
			const legendItem = legend.append( 'div' )
				.attr( 'class', 'legend-item' );

			legendItem.append( 'div' )
				.attr( 'class', 'legend-color' )
				.style( 'background-color', this.colorScale( d.post + d.id ) );

			const postTitle = d.post === '' ? __( 'Untitled', 'godam' ) : d.post;
			legendItem.append( 'div' )
				.html( `<a href="${ d.url }" target="_blank" class="pie-chart-legend">${ postTitle }</a>` );
		} );
	}

	/**
	 * Handle mouse over events
	 *
	 * @param {Event}  event - Mouse event
	 * @param {Object} d     - Data object
	 */
	handleMouseOver( event, d ) {
		d3.select( event.currentTarget.querySelector( 'path' ) )
			.transition()
			.duration( 200 )
			.attr( 'd', this.arcHover )
			.style( 'opacity', 1 );

		const percent = ( ( d.data.views / this.totalViews ) * 100 ).toFixed( 1 );
		const postTitle = d.data.post === '' ? __( 'Untitled', 'godam' ) : d.data.post;

		this.tooltip.transition()
			.duration( 200 )
			.style( 'opacity', 0.9 );

		this.tooltip.html(
			`<strong>${ postTitle }</strong><br>
				Views: ${ formatNumber( d.data.views ) }<br>
				Percentage: ${ percent }%
			` )
			.style( 'left', ( event.pageX + 10 ) + 'px' )
			.style( 'top', ( event.pageY - 28 ) + 'px' );
	}

	/**
	 * Handle mouse out events
	 *
	 * @param {Event} event - Mouse event
	 */
	handleMouseOut( event ) {
		d3.select( event.currentTarget.querySelector( 'path' ) )
			.transition()
			.duration( 200 )
			.attr( 'd', this.arc );

		this.tooltip.transition()
			.duration( 500 )
			.style( 'opacity', 0 );
	}
}

export default PostViewsChart;
