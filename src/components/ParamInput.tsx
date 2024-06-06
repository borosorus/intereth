import { FormControl, InputLabel, Input, FormHelperText } from "@mui/material";
import { ParamType, ethers } from "ethers";
import { useState } from "react";

interface ParamInputProps {
    param: ethers.ParamType;
    id: number;
    setValue: (id: number, value: string) => void;
    args: string[];
}

//TODO Input for each type, parsing
export default function ParamInput({param, id, setValue, args}: ParamInputProps) {
    const [localValue, setLocalValue] = useState('');
    const [error, setError] = useState(false);
    return (
        <FormControl sx={{width: 0.5, m: 1}}>
            <InputLabel htmlFor={`my-input-${id}`}>{param.format("full")}</InputLabel>
            <Input id={`my-input-${id}`} value={args[id]} onChange={(e) => setValue(id, e.target.value)}/>
            {/*<FormHelperText id={`my-helper-text-${id}`}>Cannot parse parameter</FormHelperText>*/}
        </FormControl>
    );
}