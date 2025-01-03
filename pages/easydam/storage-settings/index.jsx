/**
 * External dependencies
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Notice, TextControl, ToggleControl } from '@wordpress/components';
const { __ } = wp.i18n;

/**
 * Internal dependencies
 */
import AWSEdit from './components/AWSEdit.jsx';
import { setBucketPath, setNotice, setOffLoadMedia, setSettings } from '../redux/slice/settings.js';
import { useGetAWSSettingsQuery, useSaveAWSSettingsMutation } from '../redux/api/settings.js';

const StorageSettings = () => {
	const offLoadMedia = useSelector( ( state ) => state.settings.offLoadMedia );
	const bucketPath = useSelector( ( state ) => state.settings.bucketPath );
	const awsBucket = useSelector( ( state ) => state.settings.aws.bucket );

	const notice = useSelector( ( state ) => state.settings.notice );

	const [ saveMediaSettings ] = useSaveAWSSettingsMutation();

	const dispatch = useDispatch();

	const { data: settings, isLoading, error } = useGetAWSSettingsQuery();

	useEffect( () => {
		if ( error ) {
			dispatch( setNotice( { type: 'error', message: 'Failed to load AWS settings.' } ) );
		}

		if ( settings ) {
			dispatch( setSettings( { ...settings } ) );
		}
	}, [ error, dispatch, settings ] );

	const handleSaveSettings = async () => {
		const data = {
			offLoadMedia,
			bucketPath,
		};

		dispatch(
			setNotice( {
				status: 'info',
				message: '',
			} ),
		);

		try {
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

	if ( isLoading ) {
		return <p>Loading...</p>;
	}

	if ( error ) {
		return <p>Error: { error.message }</p>;
	}

	return (
		<>
			<h2 className="py-2 border-b text-xl font-bold">
				{ __( 'Storage Settings', 'transcoder' ) }
			</h2>

			{
				notice.message && (
					<Notice
						status={ notice.status }
						onRemove={ () => dispatch( setNotice( { ...notice, message: '' } ) ) }
					>
						{ notice.message }
					</Notice>
				)
			}

			<AWSEdit />

			<div className="mt-6 mx-2">
				<div className="mb-4">
					<ToggleControl
						label={ __( 'Offload Media', 'transcoder' ) }
						help={ __( 'Synchronizes newly added media files from WordPress local storage to the configured storage provider.', 'transcoder' ) }
						checked={ offLoadMedia }
						onChange={ () => dispatch( setOffLoadMedia( ! offLoadMedia ) ) }
					/>
				</div>

				<div className="mb-6">
					<TextControl
						label={ __( 'Base Path', 'transcoder' ) }
						help={ __( 'Specify the base path for storing media files in AWS S3.', 'transcoder' ) }
						value={ bucketPath }
						onChange={ ( value ) => dispatch( setBucketPath( value ) ) }
					/>
				</div>

				<div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
					<h4 className="text-md font-semibold mb-2">
						{ __( 'URL Preview', 'transcoder' ) }
					</h4>
					<p className="text-gray-600">
						<span className="text-blue-600 font-mono">
							{ `https://${ awsBucket }.s3.amazonaws.com${ bucketPath }/my-image.jpg` }
						</span>
					</p>
				</div>
			</div>

			<div className="flex mt-6 mx-2">
				<Button
					variant="primary"
					className="max-w-[140px] w-full flex justify-center items-center"
					onClick={ handleSaveSettings }
				>
					{ __( 'Save settings', 'transcoder' ) }
				</Button>
			</div>

		</>
	);
};

export default StorageSettings;
