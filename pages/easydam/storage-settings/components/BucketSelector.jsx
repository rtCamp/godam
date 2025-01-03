/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';

/**
 * WordPress dependencies
 */
import { SelectControl, TextControl } from '@wordpress/components';
const { __ } = wp.i18n;

/**
 * Internal dependencies
 */
import { setAWSBucket } from '../../redux/slice/storage';
import { useGetBucketsQuery } from '../../redux/api/storage';

const BucketSelector = () => {
	const { data, isLoading, isSuccess, refetch, isRefetching } = useGetBucketsQuery();
	const shouldRefetch = useSelector( ( state ) => state.storage.shouldRefetch );

	const aws = useSelector( ( state ) => state.storage.aws );
	const dispatch = useDispatch();

	useEffect( () => {
		refetch();
	}, [ shouldRefetch, refetch ] );

	if ( isLoading || isRefetching ) {
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
