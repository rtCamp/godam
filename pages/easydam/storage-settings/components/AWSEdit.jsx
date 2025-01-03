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
import { setAWSAccessKey, setAWSSecretKey, setNotice } from '../../redux/slice/settings';
import { useSaveAWSSettingsMutation } from '../../redux/api/settings';
import BucketSelector from './BucketSelector.jsx';

const AWSEdit = () => {
	const [ isEditOpen, setIsEditOpen ] = useState( false );

	const aws = useSelector( ( state ) => state.settings.aws );

	const dispatch = useDispatch();

	const [ saveMediaSettings ] = useSaveAWSSettingsMutation();

	const handleSaveSettings = async () => {
		dispatch(
			setNotice( {
				status: 'info',
				message: '',
			} ),
		);

		try {
			const data = { aws };

			const response = await saveMediaSettings( data ).unwrap();

			if ( response.validated ) {
				dispatch(
					setNotice( {
						status: 'success',
						message: __( 'Settings saved successfully.', 'transcoder' ),
					} ),
				);
			} else {
				dispatch(
					setNotice( {
						status: 'error',
						message: response.error || __( 'Failed to save settings. Please try different settings.', 'transcoder' ),
					} ),
				);
			}
		} catch {
			dispatch(
				setNotice( {
					status: 'error',
					message: __( 'Failed to save settings. Please try again.', 'transcoder' ),
				} ),
			);
		}
	};

	return (
		<div className="mx-auto bg-white shadow-lg border border-gray-200 rounded-lg p-6 mt-4">
			<div className="flex justify-between items-center">
				<div>
					<h3 className="text-lg font-medium">
						{ __( 'AWS S3 Bucket', 'transcoder' ) }
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
					{ __( 'Edit', 'transcoder' ) }
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
						label={ __( 'Access Key', 'transcoder' ) }
						placeholder={ __( 'Enter your AWS Access Key', 'transcoder' ) }
						value={ aws.accessKey }
						onChange={ ( value ) => dispatch( setAWSAccessKey( value ) ) }
					/>
					<TextControl
						label={ __( 'Secret Key', 'transcoder' ) }
						placeholder={ __( 'Enter your AWS Secret Key', 'transcoder' ) }
						value={ aws.secretKey }
						onChange={ ( value ) => dispatch( setAWSSecretKey( value ) ) }
					/>

					<BucketSelector />

					<div className="flex justify-end space-x-4">
						<Button
							variant="secondary"
							onClick={ () => setIsEditOpen( ! isEditOpen ) }
							className="bg-gray-200 text-gray-800 px-4 py-2 rounded"
						>
							{ __( 'Cancel', 'transcoder' ) }
						</Button>
						<Button
							variant="primary"
							className="bg-blue-500 text-white px-4 py-2 rounded"
							onClick={ handleSaveSettings }
						>
							{ __( 'Save', 'transcoder' ) }
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AWSEdit;
