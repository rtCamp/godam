/**
 * External dependencies
 */
import { useState, useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';

/**
 * WordPress dependencies
 */
import { Button, Icon, Modal, TextControl } from '@wordpress/components';
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
import JetpackIcon from '../assets/layers/JetpackIcon.svg';
import SureformsIcon from '../assets/layers/SureFormsIcons.svg';
import ForminatorIcon from '../assets/layers/Forminator.png';
import FluentFormsIcon from '../assets/layers/FluentFormsIcon.png';
import EverestFormsIcon from '../assets/layers/EverestFormsIcon.svg';
import NinjaFormsIcon from '../assets/layers/NinjaFormsIcon.png';
import MetFormIcon from '../assets/layers/MetFormIcon.png';

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
		isActive: Boolean( window?.videoData?.gfActive ) ?? false,
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
		isActive: Boolean( window?.videoData?.wpformsActive ) ?? false,
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
		isActive: Boolean( window?.videoData?.cf7Active ) ?? false,
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
		isActive: Boolean( window?.videoData?.jetpackActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/jetpack/">${ __( 'Jetpack', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 5,
		title: __( 'SureForms', 'godam' ),
		description: __( 'Collect user input using SureForms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'sureforms',
		requiresSureforms: true,
		formIcon: SureformsIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.sureformsActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/sureforms/">${ __( 'SureForms', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 6,
		title: __( 'Forminator Forms', 'godam' ),
		description: __( 'Collect user input using Forminator Forms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'forminator',
		requiresForminator: true,
		formIcon: ForminatorIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.forminatorActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/forminator">${ __( 'Forminator Forms', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 7,
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
		id: 8,
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
		id: 9,
		title: __( 'Ninja Forms', 'godam' ),
		description: __( 'Collect user input using Ninja Forms', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'ninjaforms',
		requiresNinjaForms: true,
		formIcon: NinjaFormsIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.ninjaFormsActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/ninja-forms/">${ __( 'Ninja Forms', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 10,
		title: __( 'MetForm', 'godam' ),
		description: __( 'Collect user input using MetForm', 'godam' ),
		image: Form,
		type: 'form',
		formType: 'metform',
		formIcon: MetFormIcon,
		isRequired: true,
		isActive: Boolean( window?.videoData?.metformActive ) ?? false,
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/metform/">${ __( 'MetForm', 'godam' ) }</a> ${ __( 'plugin is required to use Form layer', 'godam' ) }`,
	},
	{
		id: 11,
		title: __( 'CTA', 'godam' ),
		description: __( 'Guide users toward a specific action', 'godam' ),
		image: CTA,
		type: 'cta',
	},
	{
		id: 12,
		title: __( 'Hotspot', 'godam' ),
		description: __( 'Highlighting key areas with focus', 'godam' ),
		image: Hotspot,
		type: 'hotspot',
	},
	{
		id: 13,
		title: __( 'Ad', 'godam' ),
		description: __( 'Redirect user to custom advertisement', 'godam' ),
		image: Ad,
		type: 'ad',
	},
	{
		id: 14,
		title: __( 'Poll', 'godam' ),
		description: __( 'Gather opinions through interactive voting', 'godam' ),
		image: Poll,
		type: 'poll',
		isRequired: true,
		isActive: Boolean( window.godamMediaLibrary.isPollPluginActive ),
		requireMessage: `<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/wp-polls/">${ __( 'WP-Polls', 'godam' ) }</a> ${ __( 'plugin is required to use Poll layer', 'godam' ) }`,
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
	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ filteredLayers, setFilteredLayers ] = useState( Layers );
	const [ activeTab, setActiveTab ] = useState( 'all' );

	const uniqueLayerTypes = useMemo( () => {
		return Layers.reduce( ( acc, layer ) => {
			if ( ! acc.includes( layer.type ) ) {
				acc.push( layer.type );
			}
			return acc;
		}, [] );
	}, [] );

	// Create tabs array with "all" as the first item
	const allTabs = useMemo( () => {
		return [ 'all', ...uniqueLayerTypes ];
	}, [ uniqueLayerTypes ] );

	/**
	 * Gets the display text for a tab type.
	 *
	 * @param {string} type - The tab type.
	 * @return {string} The display text for the tab.
	 */
	const getTabDisplayText = ( type ) => {
		switch ( type ) {
			case 'all':
				return __( 'All', 'godam' );
			case 'cta':
				return type.toUpperCase();
			default:
				return type.charAt( 0 ).toUpperCase() + type.slice( 1 );
		}
	};

	/**
	 * Selects a layer when clicked.
	 *
	 * @param {Object} layer - The layer object selected by the user.
	 */
	const handleLayerSelect = ( layer ) => {
		setSelectedLayer( layer );
	};

	/**
	 * Customises and adds the selected layer.
	 * If the layer is a form, also pass the formType.
	 */
	const handleCustomiseLayer = () => {
		if ( selectedLayer.type === 'form' ) {
			addNewLayer( selectedLayer.type, selectedLayer.formType || 'gravity' );
		} else {
			addNewLayer( selectedLayer.type );
		}
		closeModal();
	};

	/**
	 * Filters layers based on the user input in the search bar.
	 *
	 * @param {string} value - The search query string.
	 */
	const handleSearchChange = ( value ) => {
		const lowerCaseQuery = value.toLowerCase();
		setSearchQuery( value );

		// Set activeTab to 'all' when user searches
		if ( activeTab !== 'all' ) {
			setActiveTab( 'all' );
		}

		const filtered = Layers.filter( ( layer ) =>
			layer.title.toLowerCase().includes( lowerCaseQuery ) ||
		layer.description.toLowerCase().includes( lowerCaseQuery ),
		);
		setFilteredLayers( filtered );
	};

	/**
	 * Handles tab click and filters layers by type.
	 * Toggles back to "all" if the same tab is clicked again.
	 *
	 * @param {string} type - The type of the layer to filter by.
	 */
	const handleTabClick = ( type ) => {
		if ( activeTab === type ) {
			setActiveTab( 'all' );
			setFilteredLayers( Layers );
			return;
		}

		// Disable search when tab is used
		setSearchQuery( '' );

		setActiveTab( type );
		if ( type === 'all' ) {
			setFilteredLayers( Layers );
		} else {
			const filtered = Layers.filter( ( layer ) => layer.type === type );
			setFilteredLayers( filtered );
		}
	};

	return (
		<Modal
			className="godam-layer-selector"
			title={ __( 'Layers', 'godam' ) }
			onRequestClose={ closeModal }
		>
			<div className="godam-layer-selector__header">
				<div className="layer-tabs">
					{ allTabs.map( ( type ) => (
						<button
							key={ type }
							className={ `layer-tab ${ activeTab === type ? 'active' : '' } ${ searchQuery ? 'disabled' : '' }` }
							onClick={ () => {
								if ( ! searchQuery ) {
									handleTabClick( type );
								}
							} }
							disabled={ !! searchQuery }
						>
							{ getTabDisplayText( type ) }
						</button>
					) ) }
				</div>

				<div className="search-container">
					<TextControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						value={ searchQuery }
						onChange={ ( value ) => {
							handleSearchChange( value );
						} }
						placeholder={ __( 'search layers…', 'godam' ) }
						className="godam-input"
					/>

				</div>
			</div>

			<div className="godam-layer-selector__list">
				{ filteredLayers.map( ( layer ) => {
					const isDisabled = true === layer?.isRequired && false === layer?.isActive;
					const isRequiredMessage = layer?.requireMessage ?? '';

					return (
						<div key={ layer.id }>
							<button
								key={ layer.id }
								className={ `godam-layer-selector__item ${ selectedLayer?.id === layer.id ? 'selected' : '' }` }
								onClick={ () => handleLayerSelect( layer ) }
								disabled={ isDisabled }
							>
								<span className="godam-layer-selector__item__inner">
									<div className="godam-layer-selector__item__image-container">
										<img
											className="godam-layer-selector__item__image-container__image"
											src={ layer.image }
											alt={ layer.title }
										/>
										{
											( layer.type === 'form' ) && layer.formIcon && (
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

									<span className={ `godam-layer-selector__item__type type-${ layer.type ?? 'layer' }` }>
										{ ( layer.type ?? __( 'Layer', 'godam' ) ).toUpperCase() }
									</span>
								</span>
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
