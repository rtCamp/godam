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
import { useIsPrimarySidebar } from '../../context/sidebar-root.jsx';
import ContactSupportLink from '../../../shared/ContactSupportLink';
import './css/snackbar.scss';

const SnackbarComp = () => {
	const message = useSelector( ( state ) => state.FolderReducer.snackbar.message );
	const type = useSelector( ( state ) => state.FolderReducer.snackbar.type );

	// The toast is a page-level singleton fed by the shared store; only the owning app
	// renders it, so two live sidebars don't stack two copies.
	const isPrimarySidebar = useIsPrimarySidebar();

	const dispatch = useDispatch();

	const handleOnRemove = () => {
		dispatch( updateSnackbar(
			{
				message: '',
				type: 'success',
			},
		) );
	};

	if ( ! message || ! isPrimarySidebar ) {
		return null;
	}

	// `error` is a real failure (service, network, unknown). It stays open until the
	// user closes it, so the "Contact Support" link can be clicked, and it ignores a
	// click on its body so that click is not mistaken for dismissing it. `fail` is
	// the user's own doing (a locked folder, a name in use), `success` and `info`
	// confirm something; all three still hide on their own after a few seconds.
	const isError = 'error' === type;

	// Portalled to <body> rather than rendered in place. The sidebar root is
	// `position: fixed; z-index: 1000`, which makes it a STACKING CONTEXT: any
	// z-index used inside it is resolved against its siblings, not the page, so the
	// toast was trapped at level 1000 and painted behind the media modal (160000)
	// no matter how high its own z-index went.
	return createPortal(
		<Snackbar
			className={ `snackbar ${ type }` }
			explicitDismiss={ isError }
			// Announce the message alone, not the "Contact Support" link after it.
			spokenMessage={ message }
			onRemove={ () => handleOnRemove() }
		>
			{ message }
			{ isError && <ContactSupportLink testId="godam-media-library-link-contact-support" /> }
		</Snackbar>,
		document.body,
	);
};

export default SnackbarComp;
