/**
 * External dependencies
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
const { __ } = wp.i18n;

/**
 * Internal dependencies
 */
import { useValidateCredentialsQuery } from '../../redux/api/storage';
import { setValidation } from '../../redux/slice/storage';

const ValidationStatus = () => {
	const { data, isLoading, refetch, isFetching, isSuccess, isError, error } = useValidateCredentialsQuery();
	const shouldRefetch = useSelector( ( state ) => state.storage.shouldRefetch );

	const dispatch = useDispatch();

	useEffect( () => {
		dispatch( setValidation(
			{
				isValid: isSuccess && data?.status === 'success',
				errorMessage: data?.message || '',
			},
		) );
	}, [ isSuccess, data, dispatch, isError ] );

	useEffect( () => {
		refetch();
	}, [ shouldRefetch, refetch ] );

	if ( isLoading ) {
		return null;
	}

	return (
		<div className="flex items-center justify-between p-4 bg-gray-50 border rounded-md shadow-sm mt-4">
			<div className="text-gray-800">
				{ isSuccess && data.status === 'success' ? (
					<span className="text-green-600 font-medium">
						{ data?.message || 'Plugin is ready for usage.' }
					</span>
				) : (
					<span className="text-red-600 font-medium">
						{ error?.data?.message || 'Something is not right.' }
					</span>
				) }
			</div>
			<Button
				variant="primary"
				className="max-w-[140px] w-full flex justify-center items-center"
				onClick={ refetch }
				disabled={ isFetching }
				isBusy={ isFetching }
			>
				{ __( 'Check again', 'godam' ) }
			</Button>
		</div>
	);
};

export default ValidationStatus;
