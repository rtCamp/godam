/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Snackbar } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { updateSnackbar } from '../../redux/slice/folders';
import './css/snackbar.css';

const SnackbarComp = () => {
	const message = useSelector( ( state ) => state.FolderReducer.snackbar.message );
	const type = useSelector( ( state ) => state.FolderReducer.snackbar.type );

	const dispatch = useDispatch();

	const handleOnRemove = () => {
		dispatch( updateSnackbar(
			{
				message: '',
				type: 'success',
			},
		) );
	};

	return (
		<>
			{ message && ( <Snackbar className={ `snackbar ${ type }` } onRemove={ () => handleOnRemove() }>{ message }</Snackbar> ) }
		</>
	);
};

export default SnackbarComp;
