/**
 * External dependencies
 */
import { useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';

/**
 * WordPress dependencies
 */
import { Button, Icon, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { cautionFilled } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './layer-selector.scss';

import Ad from '../assets/layers/Ad.png';
import CTA from '../assets/layers/CTA.png';
import Form from '../assets/layers/Form.png';
import Hotspot from '../assets/layers/Hotspot.png';
import Poll from '../assets/layers/Poll.png';
import GFIcon from '../assets/layers/GFIcon.svg';
import WPFormsIcon from '../assets/layers/WPForms-Mascot.svg';
import CF7Icon from '../assets/layers/CF7Icon.svg';
import Woo from '../assets/layers/Woo.svg';
import JetpackIcon from '../assets/layers/JetpackIcon.svg';

const Layers = [
	{
		id: 1,
		title: __( 'Gravity Forms', 'godam' ),
		description: __( 'Collect user input using Gravity Forms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'gravity',
		requiresGf: true,
		formIcon: GFIcon,
	},
	{
		id: 2,
		title: __( 'WPForms', 'godam' ),
		description: __( 'Collect user input using WPForms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'wpforms',
		requiresWPForms: true,
		formIcon: WPFormsIcon,
	},
	{
		id: 3,
		title: __( 'Contact Form 7', 'godam' ),
		description: __( 'Collect user input using Contact Form 7', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'cf7',
		requiresCF7: true,
		formIcon: CF7Icon,
	},
	{
		id: 4,
		title: __( 'Jetpack Forms', 'godam' ),
		description: __( 'Collect user input using Jetpack Forms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'jetpack',
		requiresJetpack: true,
		formIcon: JetpackIcon,
	},
	{
		id: 5,
		title: __( 'CTA', 'godam' ),
		description: __( 'Guide users toward a specific action', 'godam' ),
		image: CTA,
		type: 'cta',
	},
	{
		id: 6,
		title: __( 'Hotspot', 'godam' ),
		description: __( 'Highlighting key areas with focus', 'godam' ),
		image: Hotspot,
		type: 'hotspot',
	},
	{
		id: 7,
		title: __( 'Ad', 'godam' ),
		description: __( 'Redirect user to custom advertisement', 'godam' ),
		image: Ad,
		type: 'ad',
	},
	{
		id: 8,
		title: __( 'Poll', 'godam' ),
		description: __( 'Gather opinions through interactive voting', 'godam' ),
		image: Poll,
		type: 'poll',
		requiresWpPolls: true,
	},
	{
		id: 8,
		title: __( 'WooCommerce', 'godam' ),
		description: __( 'Display products using hotspots', 'godam' ),
		image: Hotspot,
		type: 'woo',
		requiresWoo: true,
		formIcon: Woo,
	},
];

const LayerSelector = ( { isGFPluginActive, isWPFormsPluginActive, isCF7PluginActive, isJetpackPluginActive, closeModal, addNewLayer } ) => {
	const [ selectedLayer, setSelectedLayer ] = useState( null );

	const handleLayerSelect = ( layer ) => {
		setSelectedLayer( layer );
	};

	const handleCustomiseLayer = () => {
		if ( selectedLayer.type === 'form' ) {
			addNewLayer( selectedLayer.type, selectedLayer.formType || 'gravity' );
		} else {
			addNewLayer( selectedLayer.type );
		}
		closeModal();
	};

	return (
		<Modal
			className="godam-layer-selector"
			title={ __( 'Layers', 'godam' ) }
			onRequestClose={ closeModal }
		>

			<div className="godam-layer-selector__list">
				{ Layers.map( ( layer ) => {
					const isDisabled = ( layer.requiresGf && ! isGFPluginActive ) || ( layer.requiresWPForms && ! isWPFormsPluginActive ) || ( layer.requiresCF7 && ! isCF7PluginActive ) || ( layer.requiresJetpack && ! isJetpackPluginActive ) || ( layer.requiresWpPolls && ! window.easydamMediaLibrary.isPollPluginActive ) || ( layer.requiresWoo && ! window.easydamMediaLibrary.isWooActive );
					let message = '';
					if ( layer.requiresGf && ! isGFPluginActive ) {
						message = `<a class="godam-link" href="https://docs.gravityforms.com/installation/">Gravity Forms</a> plugin is required to use Form layer`;
					} else if ( layer.requiresWPForms && ! isWPFormsPluginActive ) {
						message = `<a class="godam-link" href="https://wordpress.org/plugins/wpforms-lite/">WPForms</a> plugin is required to use Form layer`;
					} else if ( layer.requiresCF7 && ! isCF7PluginActive ) {
						message = `<a class="godam-link" href="https://wordpress.org/plugins/contact-form-7/">Contact Form 7</a> plugin is required to use Form layer`;
					} else if ( layer.requiresJetpack && ! isJetpackPluginActive ) {
						message = `<a class="godam-link" href="https://wordpress.org/plugins/jetpack/">Jetpack</a> plugin is required to use Form layer`;
					} else if ( layer.requiresWpPolls && ! window.easydamMediaLibrary.isPollPluginActive ) {
						message = `<a class="godam-link" href="https://wordpress.org/plugins/wp-polls/">WP-Polls</a> plugin is required to use Poll layer`;
					} else if ( layer.requiresWoo && ! window.easydamMediaLibrary.isWooActive ) {
						message = `<a class="godam-link" href="https://wordpress.org/plugins/woocommerce/">WooCommerce</a> plugin is required to use Buy Now layer`;
					}
					return ( <div key={ layer.id }>
						<button
							key={ layer.id }
							className={ `godam-layer-selector__item ${ selectedLayer?.id === layer.id ? 'selected' : '' }` }
							onClick={ () => handleLayerSelect( layer ) }
							disabled={ isDisabled }
						>
							<div className="godam-layer-selector__item__image-container">
								<img
									className="godam-layer-selector__item__image-container__image"
									src={ layer.image }
									alt={ layer.title }
								/>
								{
									( layer.type === 'form' || layer.type === 'woo' ) && layer.formIcon && (
										<img
											className="godam-layer-selector__item__image-container__form-icon"
											src={ layer.formIcon }
											alt={ layer.title }
										/>
									)
								}
							</div>

							<div className="godam-layer-selector__item__content">
								<h3>{ layer.title }</h3>
								<p>{ layer.description }</p>
							</div>
						</button>
						{
							isDisabled &&
								<p className="godam-layer-selector__item__message">
									<Icon icon={ cautionFilled } />
									<div dangerouslySetInnerHTML={ { __html: DOMPurify.sanitize( message ) } } />
								</p>
						}
					</div> );
				} ) }
			</div>

			<div className="godam-layer-selector__buttons">
				<Button
					variant="tertiary"
					className="godam-button"
					onClick={ closeModal }
				>
					{ __( 'Cancel', 'godam' ) }
				</Button>
				<Button
					variant="primary"
					className="godam-button"
					disabled={ ! selectedLayer }
					onClick={ () => handleCustomiseLayer() }
				>
					{ __( 'Customise Layer', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default LayerSelector;
