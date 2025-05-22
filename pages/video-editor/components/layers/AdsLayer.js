/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal, TextControl, Notice } from '@wordpress/components';
import { arrowLeft, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { removeLayer, updateLayerField } from '../../redux/slice/videoSlice';
import LayerControls from '../LayerControls';
import CustomAdSettings from '../ads/CustomAdSettings';

const CTALayer = ( { layerID, goBack, duration } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const [ isEditing, setIsEditing ] = useState( false );
	const [ initialTimePeriod, setInitialTimePeriod ] = useState( '' );
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const [ layerTime, setLayerTime ] = useState( layer?.id );
	const dispatch = useDispatch();
	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	const layers = useSelector( ( state ) => state.videoReducer.layers );

	useEffect( () => {
		setLayerTime( layer?.displayTime );
		setInitialTimePeriod( layer?.displayTime );
	}, [] );

	const isDuplicateTime = layers?.some(
		( singleLayer ) =>
			Number( singleLayer.displayTime ) === Number( layerTime ) &&
        singleLayer?.id !== layer?.id,
	);

	return (
		<>
			<div>
				<div className="flex justify-between items-center pb-3 border-b mb-3">
					<Button icon={ arrowLeft } onClick={ goBack } />
					<p className="font-semibold flex items-center gap-1">
						{ __( 'Ad layer at', 'godam' ) }
						{ isEditing ? (
							<TextControl
								__nextHasNoMarginBottom={ true }
								__next40pxDefaultSize={ false }
								value={ layerTime }
								style={ { width: 60, height: 20 } }
								onClick={ ( e ) => e.stopPropagation() }
								type="number"
								onChange={ ( value ) => {
									// Remove leading zeros
									let normalizedValue = value.replace( /^0+(?=\d)/, '' );

									// Limit to 2 decimal places
									if ( normalizedValue.includes( '.' ) ) {
										const [ intPart, decimalPart ] = normalizedValue.split( '.' );
										normalizedValue = intPart + '.' + decimalPart.slice( 0, 2 );
									}

									// Convert to number for validation
									const floatValue = parseFloat( normalizedValue );

									if ( floatValue > duration ) {
										return;
									}

									// Reject empty or over-duration values
									if ( normalizedValue === '' || isNaN( floatValue ) ) {
										setLayerTime( normalizedValue );
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: initialTimePeriod,
										} ) );
										return;
									}

									setLayerTime( normalizedValue );

									// Check for duplicate timestamp
									const isTimestampExists = layers?.some(
										( singleLayer ) =>
											Number( singleLayer.displayTime ) === floatValue &&
																			singleLayer?.id !== layer?.id,
									);

									if ( isTimestampExists ) {
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: initialTimePeriod,
										} ) );
									} else {
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: normalizedValue,
										} ) );
									}
								} }
								min={ 0 }
								max={ duration }
								step={ 0.1 }
							/>
						) : (
							<button
								onClick={ () => setIsEditing( true ) }
								className="cursor-pointer bg-transparent text-inherit p-0"
							>
								{ layer.displayTime }s
							</button>
						) }
					</p>
					<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
					{ isOpen && (
						<Modal
							title={ __( 'Delete layer', 'godam' ) }
							onRequestClose={ () => setOpen( false ) }
						>
							<div className="flex justify-between items-center gap-3">
								<Button
									className="w-full justify-center"
									isDestructive
									variant="primary"
									onClick={ handleDeleteLayer }
								>
									{ __( 'Delete layer', 'godam' ) }
								</Button>
								<Button
									className="w-full justify-center"
									variant="secondary"
									onClick={ () => setOpen( false ) }
								>
									{ __( 'Cancel', 'godam' ) }
								</Button>
							</div>
						</Modal>
					) }
				</div>
				{ isDuplicateTime && isEditing && <Notice
					className="mb-4"
					status="error"
					isDismissible={ true }
				>
					{ __( 'A layer already exists at this timestamp!', 'godam' ) }
				</Notice>
				}
				{
					isEditing && '' === layerTime && <Notice
						className="mb-4"
						status="error"
						isDismissible={ true }
					>
						{ __( 'The timestamp cannot be an empty value!', 'godam' ) }
					</Notice>
				}
			</div>

			<div>
				<CustomAdSettings layerID={ layer.id } />
			</div>

			<LayerControls>
				<div className="absolute inset-0 px-4 py-8 bg-white bg-opacity-70 my-auto">
					<h3 className="text-2xl font-semibold text-gray-500 absolute bottom-4 right-6">
						{ __( 'Self hosted video Ad', 'godam' ) }
					</h3>
				</div>
			</LayerControls>
		</>
	);
};

export default CTALayer;
