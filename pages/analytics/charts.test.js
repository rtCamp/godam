/**
 * Unit tests for the Post Views donut chart: host-post titles and links go into the
 * legend, the hover tooltip and the slices as text and attributes, never as markup.
 *
 * Runs against the real d3 build the analytics page loads, not a stub.
 */

/**
 * Internal dependencies
 */
import { generatePostViewsChart } from './charts';

const d3 = require( '../../assets/src/libs/d3.js' );

const HOSTILE_TITLE = '<img src=x onerror="window.__ran = 1"><b>bold</b>';

const render = ( posts ) => {
	document.body.innerHTML = '<div id="post-views-count-chart"></div><div id="legend"></div>';
	generatePostViewsChart( posts, '#post-views-count-chart' );
};

const XLINK_NS = 'http://www.w3.org/1999/xlink';

const legendLinks = () => [ ...document.querySelectorAll( '#legend a.pie-chart-legend' ) ];
const sliceLinks = () => [ ...document.querySelectorAll( '#post-views-count-chart svg a' ) ];
const sliceHref = ( slice ) => slice.getAttributeNS( XLINK_NS, 'href' );

/**
 * The tooltip's content as a list of its parts, ignoring the whitespace between them.
 *
 * @param {HTMLElement} tooltip Tooltip element.
 * @return {string[]} Text of each part, with '<br>' for a line break.
 */
const tooltipParts = ( tooltip ) => [ ...tooltip.childNodes ].map(
	( node ) => ( 'BR' === node.nodeName ? '<br>' : node.textContent.trim() ),
);

/**
 * Hover a slice, the way the tooltip is opened.
 *
 * @param {number} index Slice index.
 * @return {HTMLElement} The tooltip element.
 */
const hoverSlice = ( index ) => {
	const slice = sliceLinks()[ index ].querySelector( 'path' );
	slice.dispatchEvent( new window.MouseEvent( 'mouseover', { bubbles: true } ) );
	return document.querySelector( 'div.tooltip' );
};

describe( 'generatePostViewsChart', () => {
	beforeEach( () => {
		window.d3 = d3;
		window.__ran = 0;
	} );

	afterEach( () => {
		document.body.innerHTML = '';
		delete window.d3;
	} );

	it( 'lists each post in the legend, linked to its page', () => {
		render( [
			{ id: 1, post: 'Hello world', views: 1500, url: 'https://example.com/hello/' },
			{ id: 2, post: 'About us', views: 20, url: 'http://example.com/about/?a=1&b=2' },
		] );

		const links = legendLinks();
		expect( links.map( ( a ) => a.textContent ) ).toEqual( [ 'Hello world', 'About us' ] );
		expect( links.map( ( a ) => a.getAttribute( 'href' ) ) ).toEqual( [
			'https://example.com/hello/',
			'http://example.com/about/?a=1&b=2',
		] );
		expect( links.every( ( a ) => a.getAttribute( 'target' ) === '_blank' ) ).toBe( true );
		expect( sliceLinks().map( sliceHref ) ).toEqual( [
			'https://example.com/hello/',
			'http://example.com/about/?a=1&b=2',
		] );
	} );

	it( 'shows the title, views and share in the tooltip', () => {
		render( [
			{ id: 1, post: 'Hello world', views: 1500, url: 'https://example.com/hello/' },
			{ id: 2, post: 'About us', views: 500, url: 'https://example.com/about/' },
		] );

		const tooltip = hoverSlice( 0 );

		expect( tooltip.querySelector( 'strong' ).textContent ).toBe( 'Hello world' );
		expect( tooltipParts( tooltip ) ).toEqual( [ 'Hello world', '<br>', 'Views: 1,500', '<br>', 'Percentage: 75.0%' ] );
	} );

	it( 'decodes the HTML entities WordPress puts in a title', () => {
		render( [ { id: 1, post: 'Tom &amp; Jerry&#8217;s &#8211; the &quot;best&quot;', views: 10, url: 'https://example.com/tj/' } ] );

		const expected = 'Tom & Jerry’s – the "best"';
		expect( legendLinks()[ 0 ].textContent ).toBe( expected );
		expect( hoverSlice( 0 ).querySelector( 'strong' ).textContent ).toBe( expected );
	} );

	it( 'labels a post with no title as Untitled', () => {
		render( [ { id: 1, post: '', views: 10, url: 'https://example.com/p/' } ] );

		expect( legendLinks()[ 0 ].textContent ).toBe( 'Untitled' );
		expect( hoverSlice( 0 ).querySelector( 'strong' ).textContent ).toBe( 'Untitled' );
	} );

	it( 'shows a title containing markup as text in the legend and the tooltip', () => {
		render( [ { id: 1, post: HOSTILE_TITLE, views: 10, url: 'https://example.com/p/' } ] );

		const link = legendLinks()[ 0 ];
		expect( link.textContent ).toBe( HOSTILE_TITLE );
		expect( link.children ).toHaveLength( 0 );

		const tooltip = hoverSlice( 0 );
		expect( tooltip.querySelector( 'strong' ).textContent ).toBe( HOSTILE_TITLE );
		expect( tooltip.querySelector( 'img, b' ) ).toBeNull();

		expect( document.querySelector( '[onerror]' ) ).toBeNull();
		expect( window.__ran ).toBe( 0 );
	} );

	it( 'keeps a link containing quotes inside the href attribute', () => {
		render( [ { id: 1, post: 'Post', views: 10, url: 'https://example.com/" onmouseover="window.__ran = 2' } ] );

		const link = legendLinks()[ 0 ];
		expect( link.getAttribute( 'href' ) ).toContain( 'onmouseover' );
		expect( link.hasAttribute( 'onmouseover' ) ).toBe( false );
		expect( link.textContent ).toBe( 'Post' );
	} );

	it( 'does not link a post whose URL is not http(s)', () => {
		render( [ { id: 1, post: 'Post', views: 10, url: 'javascript:window.__ran = 3' } ] );

		const link = legendLinks()[ 0 ];
		expect( link.hasAttribute( 'href' ) ).toBe( false );
		expect( link.textContent ).toBe( 'Post' );
		expect( sliceHref( sliceLinks()[ 0 ] ) ).toBeNull();
	} );

	it( 'replaces the previous render instead of stacking', () => {
		const posts = [ { id: 1, post: 'Hello', views: 10, url: 'https://example.com/hello/' } ];
		render( posts );
		generatePostViewsChart( posts, '#post-views-count-chart' );

		expect( legendLinks() ).toHaveLength( 1 );
		expect( document.querySelectorAll( 'div.tooltip' ) ).toHaveLength( 1 );
		expect( document.querySelectorAll( '#post-views-count-chart svg' ) ).toHaveLength( 1 );
	} );
} );
