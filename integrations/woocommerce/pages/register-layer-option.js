/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

console.log( 'register-layer-option.js loaded' );

/**
 * Internal dependencies
 */
import Hotspot from '../../../pages/video-editor/assets/layers/Hotspot.png';
import Woo from '../../../pages/video-editor/assets/layers/woo.svg';

/**
 * Register WooCommerce layer option in the Layer Selector.
 *
 * This filter allows the WooCommerce integration to add its layer option
 * to the layer selector modal without the core video editor having direct knowledge of it.
 *
 * @param {Array} layers - Existing layer options.
 * @return {Array} Updated layer options including WooCommerce.
 */
const registerWoocommerceLayerOption = ( layers ) => {
	return [
		...layers,
		{
			id: 15,
			title: __( 'WooCommerce', 'godam' ),
			description: __( 'Display products using hotspots', 'godam' ),
			image: Hotspot,
			type: 'woo',
			requiresWoo: true,
			formIcon: Woo,
			isRequired: true,
			isActive: Boolean( window.easydamMediaLibrary?.isWooActive ) ?? false,
			requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/woocommerce/">${ __( 'WooCommerce', 'godam' ) }</a> ${ __( 'plugin is required to use WooCommerce layer', 'godam' ) }`,
		},
	];
};

addFilter(
	'godam.videoEditor.layerOptions',
	'godam/woocommerce/register-layer-option',
	registerWoocommerceLayerOption,
);

export default registerWoocommerceLayerOption;
