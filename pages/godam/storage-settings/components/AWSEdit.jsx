/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';
const { __ } = wp.i18n;

/**
 * Internal dependencies
 */
import { setAWSAccessKey, setAWSSecretKey } from '../../redux/slice/storage';
import { useEffect } from 'react';

const AWSEdit = ( { handleSaveSettings } ) => {
	const [ isEditOpen, setIsEditOpen ] = useState( false );
	const [ isConnectEnabled, setIsConnectEnabled ] = useState( true );

	const aws = useSelector( ( state ) => state.storage.aws );
	const validation = useSelector( ( state ) => state.storage.validation );
	const shouldRefetch = useSelector( ( state ) => state.storage.shouldRefetch );

	const dispatch = useDispatch();

	useEffect( () => {
		if ( validation.isValid ) {
			setIsConnectEnabled( false );
		} else {
			setIsConnectEnabled( true );
		}
	}, [ validation, shouldRefetch ] );

	return (
		<div className="mx-auto bg-white shadow-lg border border-gray-200 rounded-lg p-6 mt-4">
			<div className="flex justify-between items-center">
				<div>
					<h3 className="text-lg font-medium">
						{ __( 'AWS S3 Bucket', 'godam' ) }
					</h3>
					<p className="text-gray-500 mt-1">
						<strong>{ aws.bucket }</strong>
					</p>
				</div>
				<Button
					variant="secondary"
					onClick={ () => setIsEditOpen( ! isEditOpen ) }
					className="bg-blue-500 text-white font-medium px-4 py-2 rounded"
					disabled={ isEditOpen }
				>
					{ __( 'Edit', 'godam' ) }
				</Button>
			</div>

			{ /* Slide-Down Edit Panel */ }
			<div
				className={ `overflow-hidden transition-all duration-500 ease-in-out mx-auto ${
					isEditOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
				}` }
			>
				<div className="py-6 space-y-4">
					<TextControl
						label={ __( 'Access Key', 'godam' ) }
						placeholder={ __( 'Enter your AWS Access Key', 'godam' ) }
						disabled={ ! isConnectEnabled }
						value={ aws.accessKey }
						onChange={ ( value ) => dispatch( setAWSAccessKey( value ) ) }
					/>
					<TextControl
						label={ __( 'Secret Key', 'godam' ) }
						placeholder={ __( 'Enter your AWS Secret Key', 'godam' ) }
						disabled={ ! isConnectEnabled }
						value={ aws.secretKey }
						onChange={ ( value ) => dispatch( setAWSSecretKey( value ) ) }
					/>

					<div className="flex justify-end space-x-4">
						<Button
							variant="secondary"
							onClick={ () => setIsEditOpen( ! isEditOpen ) }
							className="bg-gray-200 text-gray-800 px-4 py-2 rounded"
						>
							{ __( 'Cancel', 'godam' ) }
						</Button>
						{ isConnectEnabled && (
							<Button
								variant="primary"
								className="bg-blue-500 text-white px-4 py-2 rounded"
								onClick={ () => handleSaveSettings( {
									aws: {
										accessKey: aws.accessKey,
										secretKey: aws.secretKey,
									},
								} ) }
							>
								{ __( 'Connect', 'godam' ) }
							</Button>
						) }

						{ ! isConnectEnabled && (
							<Button
								className="text-white px-4 py-2 rounded"
								variant="primary"
								isDestructive={ true }
								onClick={ () => setIsConnectEnabled( true ) }
							>
								{ __( 'Disconnect', 'godam' ) }
							</Button>
						) }

					</div>
				</div>
			</div>
		</div>
	);
};

export default AWSEdit;
