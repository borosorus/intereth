import { TextField } from "@mui/material";
import { ethers } from "ethers";

interface ParamInputProps {
    param: ethers.ParamType;
    id: number;
    setValue: (id: number, value: string) => void;
    args: string[];
}

export default function ParamInput({param, id, setValue, args}: ParamInputProps) {
    return (
        <TextField
          id={`my-input-${id}`}
          label={param.format("full")}
          value={args[id]}
          onChange={(e) => setValue(id, e.target.value)}
          size="small"
          fullWidth
          sx={{mb: 1}}
        />
    );
}
