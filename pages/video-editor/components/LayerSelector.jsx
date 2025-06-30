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
import Woo from '../assets/layers/woo.svg';
import JetpackIcon from '../assets/layers/JetpackIcon.svg';
import SureformsIcon from '../assets/layers/SureFormsIcons.svg';
import FluentFormsIcon from '../assets/layers/FluentFormsIcon.png';
import EverestFormsIcon from '../assets/layers/EverestFormsIcon.svg';

const Layers = [
	{
		id: 1,
		title: __( 'Gravity Forms', 'godam' ),
		description: __( 'Collect user input using Gravity Forms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'gravity',
		formIcon: GFIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.gf_active ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://docs.gravityforms.com/installation/">${ __( 'Gravity Forms', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 2,
		title: __( 'WPForms', 'godam' ),
		description: __( 'Collect user input using WPForms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'wpforms',
		formIcon: WPFormsIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.wpforms_active ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/wpforms-lite/">${ __( 'WP Forms', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 3,
		title: __( 'Contact Form 7', 'godam' ),
		description: __( 'Collect user input using Contact Form 7', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'cf7',
		formIcon: CF7Icon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.cf7_active ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/contact-form-7/">${ __( 'Contact Form 7', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
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
		isRequired: true,
		isActive: Boolean( window?.videoData?.jetpack_active ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/jetpack/">${ __( 'Jetpack', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 5,
		title: __( 'SureForms', 'godam' ),
		description: __( 'Collect user input using Sureforms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'sureforms',
		requiresSureforms: true,
		formIcon: SureformsIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.sureformsActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/sureforms/">${ __( 'SureForms', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{	id: 6,
		title: __( 'Fluent Forms', 'godam' ),
		description: __( 'Collect user input using Fluent Forms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'fluentforms',
		requiresFluentForms: true,
		formIcon: FluentFormsIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.fluentformsActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/fluentform">${ __( 'Fluent Forms', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 7,
		title: __( 'Everest Forms', 'godam' ),
		description: __( 'Collect user input using Everest Forms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'everestforms',
		requiresEverestForms: true,
		formIcon: EverestFormsIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.everestFormsActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/everest-forms/">${ __( 'Everest Forms', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 8,
		title: __( 'CTA', 'godam' ),
		description: __( 'Guide users toward a specific action', 'godam' ),
		image: CTA,
		type: 'cta',
	},
	{
		id: 9,
		title: __( 'Hotspot', 'godam' ),
		description: __( 'Highlighting key areas with focus', 'godam' ),
		image: Hotspot,
		type: 'hotspot',
	},
	{
		id: 10,
		title: __( 'Ad', 'godam' ),
		description: __( 'Redirect user to custom advertisement', 'godam' ),
		image: Ad,
		type: 'ad',
	},
	{
		id: 11,
		title: __( 'Poll', 'godam' ),
		description: __( 'Gather opinions through interactive voting', 'godam' ),
		image: Poll,
		type: 'poll',
		isRequired: true,
		isActive: Boolean( window.easydamMediaLibrary.isPollPluginActive ),
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/wp-polls/">${ __( 'WP-Polls', 'godam' ) }</a> ${ __( 'plugin is required to use Poll layer', 'godam' ) }`,
	},
	{
		id: 12,
		title: __( 'WooCommerce', 'godam' ),
		description: __( 'Display products using hotspots', 'godam' ),
		image: Hotspot,
		type: 'woo',
		requiresWoo: true,
		formIcon: Woo,
		isRequired: true,
		isActive: Boolean( window.easydamMediaLibrary.isWooActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/woocommerce/">${ __( 'WooCommerce', 'godam' ) }</a> ${ __( 'plugin is required to use Buy Now layer', 'godam' ) }`,
	},
];

/**
 * Modal to select the layer to be added on the video at a particular timestamp.
 *
 * @param {Object}   param0             - Props passed to the LayerSelector component.
 * @param {Function} param0.closeModal  - Function to close the modal.
 * @param {Function} param0.addNewLayer - Function to add a new layer at the selected timestamp.
 *
 * @return {JSX.Element} The rendered LayerSelector component.
 */
const LayerSelector = ( { closeModal, addNewLayer } ) => {
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
					const isDisabled = true === layer?.isRequired && false === layer?.isActive;
					const isRequiredMessage = layer?.requireMessage ?? '';

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
									<div dangerouslySetInnerHTML={ { __html: DOMPurify.sanitize( isRequiredMessage ) } } />
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
