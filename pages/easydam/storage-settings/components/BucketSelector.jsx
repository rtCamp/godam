/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { SelectControl, TextControl } from '@wordpress/components';
const { __ } = wp.i18n;

/**
 * Internal dependencies
 */
import { setAWSBucket } from '../../redux/slice/settings';
import { useGetBucketsQuery } from '../../redux/api/settings';

const BucketSelector = () => {
	const { data, isLoading, isSuccess } = useGetBucketsQuery();

	const aws = useSelector( ( state ) => state.settings.aws );
	const dispatch = useDispatch();

	if ( isLoading ) {
		return <p>Loading...</p>;
	}

	if ( isSuccess && data?.length > 0 ) {
		return (
			<SelectControl
				label={ __( 'Bucket Name', 'transcoder' ) }
				value={ aws.bucket }
				options={ data.map( ( bucket ) => ( { label: bucket, value: bucket } ) ) }
				onChange={ ( value ) => dispatch( setAWSBucket( value ) ) }
			/>
		);
	}

	// If no buckets are available or an error occurs, show the input field
	return (
		<TextControl
			label={ __( 'Bucket Name', 'transcoder' ) }
			placeholder={ __( 'Enter your AWS S3 Bucket Name ( required incase bucket selection not provided', 'transcoder' ) }
			value={ aws.bucket }
			onChange={ ( value ) => dispatch( setAWSBucket( value ) ) }
		/>
	);
};

export default BucketSelector;
