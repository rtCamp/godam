/* global d3, godamPluginData */

/**
 * Internal dependencies
 */
import { d3CountryToIso } from '../utils';

/**
 * Country Heatmap and Table Visualization
 */
class CountryHeatmapChart {
	/**
	 * @param {Object} countryData   - { CountryName: viewCount }
	 * @param {string} mapSelector   - Selector for the map container
	 * @param {string} tableSelector - Selector for the table container
	 */
	constructor( countryData, mapSelector, tableSelector ) {
		this.countryData = countryData;
		this.mapSelector = mapSelector;
		this.tableSelector = tableSelector;

		this.width = 800;
		this.height = 500;
		this.countryDataArray = Object.entries( countryData )
			.map( ( [ country, views ] ) => ( { country, views } ) )
			.sort( ( a, b ) => b.views - a.views );
		this.totalViews = d3.sum( this.countryDataArray, ( d ) => d.views );
		this.maxViews = d3.max( this.countryDataArray, ( d ) => d.views );

		this.init();
	}

	init() {
		this.createMapContainer();
		this.createZoomControls();
		this.createTooltip();
		this.createSVG();
		this.loadMapData();
		this.renderTable();
	}

	createMapContainer() {
		this.container = d3.select( this.mapSelector )
			.style( 'position', 'relative' )
			.style( 'width', '100%' )
			.style( 'height', 'auto' );

		this.container.append( 'h2' )
			.text( 'Views by Location' )
			.style( 'font-size', '16px' )
			.style( 'font-weight', '700' )
			.style( 'text-align', 'left' )
			.style( 'margin-bottom', '16px' );
	}

	createTooltip() {
		this.tooltip = this.container
			.append( 'div' )
			.attr( 'class', 'map-tooltip' )
			.style( 'position', 'absolute' )
			.style( 'background', 'rgba(0, 0, 0, 0.8)' )
			.style( 'color', '#fff' )
			.style( 'padding', '5px 10px' )
			.style( 'border-radius', '5px' )
			.style( 'display', 'none' )
			.style( 'font-size', '14px' )
			.style( 'pointer-events', 'none' )
			.style( 'z-index', '100' );
	}

	createSVG() {
		this.svg = this.container
			.append( 'svg' )
			.attr( 'viewBox', `0 0 ${ this.width } ${ this.height }` )
			.attr( 'preserveAspectRatio', 'xMidYMid meet' )
			.style( 'width', '100%' )
			.style( 'height', 'auto' );

		this.g = this.svg.append( 'g' );

		this.zoom = d3.zoom()
			.scaleExtent( [ 1, 8 ] )
			.on( 'zoom', ( event ) => {
				this.g.attr( 'transform', event.transform );
			} );

		this.svg.call( this.zoom );
		this.initialTransform = d3.zoomIdentity;
	}

	createZoomControls() {
		const zoomControls = this.container
			.append( 'div' )
			.attr( 'class', 'zoom-controls' )
			.style( 'position', 'absolute' )
			.style( 'top', '20px' )
			.style( 'right', '0px' )
			.style( 'display', 'flex' )
			.style( 'flex-direction', 'column' )
			.style( 'gap', '10px' )
			.style( 'z-index', '10' );

		const buttons = [
			{ label: '+', action: () => this.svg.transition().call( this.zoom.scaleBy, 1.3 ) },
			{ label: '–', action: () => this.svg.transition().call( this.zoom.scaleBy, 1 / 1.3 ) },
			{ label: '⟳', action: () => this.svg.transition().duration( 500 ).call( this.zoom.transform, this.initialTransform ) },
		];

		buttons.forEach( ( btn ) => {
			zoomControls.append( 'button' )
				.text( btn.label )
				.style( 'width', '20px' )
				.style( 'height', '20px' )
				.style( 'font-size', '14px' )
				.style( 'cursor', 'pointer' )
				.style( 'border-radius', '5px' )
				.style( 'background', '#52525B' )
				.style( 'color', '#fff' )
				.on( 'click', btn.action );
		} );
	}

	loadMapData() {
		d3.json( 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson' ).then( ( worldData ) => {
			const colorScale = d3
				.scaleSequential()
				.domain( [ 0, this.maxViews ] )
				.interpolator( ( t ) => d3.interpolateRgb( '#ddd', '#AB3A6C' )( t ) );

			const features = worldData.features.filter(
				( f ) => f.properties.name !== 'Antarctica',
			);

			const projection = d3.geoEquirectangular().fitExtent(
				[ [ 20, 20 ], [ this.width - 20, this.height - 20 ] ],
				{ type: 'FeatureCollection', features },
			);

			const path = d3.geoPath().projection( projection );

			this.g.selectAll( 'path' )
				.data( features )
				.enter()
				.append( 'path' )
				.attr( 'd', path )
				.attr( 'fill', ( d ) => {
					const name = d.properties.name;
					return this.countryData[ name ]
						? colorScale( this.countryData[ name ] )
						: '#ddd';
				} )
				.attr( 'stroke', 'none' )
				.on( 'mouseover', ( event, d ) => this.handleMapMouseOver( event, d, colorScale ) )
				.on( 'mousemove', ( event ) => this.handleMapMouseMove( event ) )
				.on( 'mouseout', ( event, d ) => this.handleMapMouseOut( event, d, colorScale ) );
		} );
	}

	handleMapMouseOver( event, d, colorScale ) {
		const country = d.properties.name;
		const views = this.countryData[ country ];
		const [ x, y ] = d3.pointer( event, this.container.node() );

		if ( views ) {
			const pct = Math.round( ( views / this.totalViews ) * 100 );
			const radius = 20;
			const circumference = 2 * Math.PI * radius;
			const dash = ( circumference * pct ) / 100;

			this.tooltip
				.style( 'display', 'block' )
				.style( 'left', x + 10 + 'px' )
				.style( 'top', y + 10 + 'px' )
				.html( `
					<div style="text-align:center; font-family:Arial,sans-serif">
						<strong>${ country }</strong><br/>
						<svg width="50" height="50">
							<circle cx="25" cy="25" r="${ radius }" fill="none" stroke="#eee" stroke-width="4"/>
							<circle cx="25" cy="25" r="${ radius }" fill="none" stroke="#AB3A6C" stroke-width="4"
								stroke-dasharray="${ dash } ${ circumference - dash }"
								transform="rotate(-90 25 25)"/>
							<text x="25" y="30" text-anchor="middle" font-size="12" fill="#fff">${ pct }%</text>
						</svg>
						<div style="margin-top:4px; font-size:12px; color:#fff">${ views } plays</div>
					</div>
				` );

			const darker = d3.color( colorScale( views ) ).darker( 1 ).formatHex();
			d3.select( event.currentTarget ).attr( 'fill', darker );
		}
	}

	handleMapMouseMove( event ) {
		const [ x, y ] = d3.pointer( event, this.container.node() );
		this.tooltip.style( 'left', x + 10 + 'px' ).style( 'top', y + 10 + 'px' );
	}

	handleMapMouseOut( event, d, colorScale ) {
		this.tooltip.style( 'display', 'none' );
		const name = d.properties.name;
		const fill = this.countryData[ name ] ? colorScale( this.countryData[ name ] ) : '#ddd';
		d3.select( event.currentTarget ).attr( 'fill', fill );
	}

	renderTable() {
		const tableDiv = d3.select( this.tableSelector );

		const table = tableDiv.append( 'table' )
			.style( 'width', '100%' )
			.style( 'border-collapse', 'collapse' )
			.style( 'font-family', 'Arial, sans-serif' );

		const tbody = table.append( 'tbody' );

		tbody.selectAll( 'tr' )
			.data( this.countryDataArray )
			.enter()
			.each( function( d ) {
				const mainRow = d3.select( this ).append( 'tr' );

				const countryCell = mainRow.append( 'td' )
					.style( 'text-align', 'left' )
					.style( 'font-weight', '500' )
					.style( 'vertical-align', 'middle' );

				const flagWrapper = countryCell.append( 'div' )
					.style( 'display', 'flex' )
					.style( 'align-items', 'center' )
					.style( 'gap', '8px' );

				const flagCode = d3CountryToIso[ d.country ];
				if ( flagCode ) {
					flagWrapper.append( 'img' )
						.attr( 'src', `${ godamPluginData.flagBasePath }/${ flagCode }.svg` )
						.attr( 'alt', `${ d.country } flag` )
						.style( 'width', '18px' )
						.style( 'height', '18px' )
						.style( 'border-radius', '50%' )
						.style( 'object-fit', 'cover' )
						.style( 'flex-shrink', '0' );
				}

				flagWrapper.append( 'span' ).text( d.country );

				mainRow.append( 'td' )
					.text( `${ Math.round( ( d.views / this.totalViews ) * 100 ) }%` )
					.style( 'text-align', 'right' )
					.style( 'font-weight', '500' )
					.style( 'padding', '10px' );

				const barRow = d3.select( this ).append( 'tr' );

				const progressContainer = barRow.append( 'td' )
					.attr( 'colspan', 2 )
					.append( 'div' )
					.style( 'height', '6px' )
					.style( 'width', '100%' )
					.style( 'background-color', '#E4E4E7' )
					.style( 'border-radius', '8px' )
					.style( 'overflow', 'hidden' );

				progressContainer.append( 'div' )
					.style( 'height', '100%' )
					.style( 'width', `${ ( d.views / this.totalViews ) * 100 }%` )
					.style( 'background-color', '#AB3A6C' )
					.style( 'border-radius', '8px' );
			}.bind( this ) );
	}
}

export default CountryHeatmapChart;
