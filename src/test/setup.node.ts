// Setup dos testes (ambiente Node): desliga a bandeja 3D para que as
// rolagens resolvam na hora via RNG, sem esperar a física dos dados.
import { useDice3DStore } from "@/stores/useDice3DStore";
useDice3DStore.setState({ enabled: false });
