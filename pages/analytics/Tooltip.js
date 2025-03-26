/**
 * Internal dependencies
 */
import Info from '../../assets/src/images/info.png';

const Tooltip = ({ text }) => {
	return (
		<span id="tooltip-container">
			<img src={ Info } height={ 11 } width={ 11 } alt="info icon" />
			<span className="tooltip-text">{ text }</span>
		</span>
	);
};

export default Tooltip;
