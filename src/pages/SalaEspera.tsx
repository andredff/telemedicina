import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function SalaEspera() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/consulta/${id}/preparacao`, { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [id, navigate]);

  return null;
}
