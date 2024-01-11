import React from 'react';

const Setting = ({
	label,
	type,
	id,
	name,
	min,
	max,
	step,
	value,
	onChange,
	unit,
}) => {
	return (
		<div className='mb-2'>
			<label htmlFor={id} className='mr-2'>
				{label}:
			</label>
			{type === 'range' && (
				<input
					type={type}
					id={id}
					name={name}
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={onChange}
					className='h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700'
				/>
			)}

			<input
				type='number'
				id={`${id}Input`}
				name={`${name}Input`}
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={onChange}
				className='ml-1 w-20 p-2 px-4 text-white rounded-md border-0ring-1 ring-inset ring-gray-30 focus:ring-2 focus:ring-inset focus:ring-indigo-600'
			/>

			<span className='ml-2'>{unit}</span>
		</div>
	);
};

export default Setting;
