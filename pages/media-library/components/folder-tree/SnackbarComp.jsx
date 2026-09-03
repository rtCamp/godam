/**
 * External dependencies
 */
import { createPortal } from 'react-dom';
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Snackbar } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { updateSnackbar } from '../../redux/slice/folders';
import './css/snackbar.scss';

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

	if ( ! message ) {
		return null;
	}

	// Portalled to <body> rather than rendered in place. The sidebar root is
	// `position: fixed; z-index: 1000`, which makes it a STACKING CONTEXT: any
	// z-index used inside it is resolved against its siblings, not the page, so the
	// toast was trapped at level 1000 and painted behind the media modal (160000)
	// no matter how high its own z-index went.
	return createPortal(
		<Snackbar className={ `snackbar ${ type }` } onRemove={ () => handleOnRemove() }>{ message }</Snackbar>,
		document.body,
	);
};

export default SnackbarComp;
