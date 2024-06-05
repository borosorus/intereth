import { FormControl, InputLabel, Input } from "@mui/material";
import { ethers } from "ethers";

interface ParamInputProps {
    param: ethers.ParamType;
    id: number;
    setValue: (id: number, value: string) => void;
    args: string[];
}

//TODO Input for each type, parsing
export default function ParamInput({param, id, setValue, args}: ParamInputProps) {
    return (
        <FormControl sx={{width: 0.5, m: 1}}>
            <InputLabel htmlFor="my-input">{param.format("full")}</InputLabel>
            <Input id="my-input" aria-describedby="my-helper-text" value={args[id]} onChange={(e) => setValue(id, e.target.value)}/>
        </FormControl>
    );
}