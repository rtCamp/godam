/**
 * External dependencies
 */
import { useState } from 'react';

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './layer-selector.scss';

import Ad from '../assets/layers/Ad.png';
import CTA from '../assets/layers/CTA.png';
import Form from '../assets/layers/Form.png';
import Hotspot from '../assets/layers/Hotspot.png';
import Poll from '../assets/layers/Poll.png';

const Layers = [
	{
		id: 1,
		title: __( 'Form', 'godam' ),
		description: 'Collect user input using different forms',
		image: Form,
		type: 'form',
		requiresGf: true,
	},
	{
		id: 2,
		title: __( 'CTA', 'godam' ),
		description: 'Guide users toward a specific action',
		image: CTA,
		type: 'cta',
	},
	{
		id: 3,
		title: __( 'Hotspot', 'godam' ),
		description: 'Highlighting key areas with focus',
		image: Hotspot,
		type: 'hotspot',
	},
	{
		id: 4,
		title: __( 'Ad', 'godam' ),
		description: 'Redirect user to custom advertisement',
		image: Ad,
		type: 'ad',
	},
	{
		id: 5,
		title: __( 'Poll', 'godam' ),
		description: 'Gather opinions through interactive voting',
		image: Poll,
		type: 'poll',
		requiresWpPolls: true,
	},
];

const LayerSelector = ( { isGFPluginActive, closeModal, addNewLayer } ) => {
	const [ selectedLayer, setSelectedLayer ] = useState( null );

	const handleLayerSelect = ( layer ) => {
		setSelectedLayer( layer );
	};

	const handleCustomiseLayer = () => {
		addNewLayer( selectedLayer.type );
		closeModal();
	};

	return (
		<Modal
			className="godam-layer-selector"
			title={ __( 'Layers', 'godam' ) }
			onRequestClose={ closeModal }
		>

			<div className="godam-layer-selector__list">
				{ Layers.map( ( layer ) => (
					<button
						key={ layer.id }
						className={ `godam-layer-selector__item ${ selectedLayer?.id === layer.id ? 'selected' : '' }` }
						onClick={ () => handleLayerSelect( layer ) }
						disabled={ ( layer.requiresGf && ! isGFPluginActive ) || ( layer.requiresWpPolls && ! window.easydamMediaLibrary.isPollPluginActive ) }
					>
						<img
							className="godam-layer-selector__item__image"
							src={ layer.image }
							alt={ layer.title }
						/>

						<div className="godam-layer-selector__item__content">
							<h3>{ layer.title }</h3>
							<p>{ layer.description }</p>
						</div>
					</button>
				) ) }
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
