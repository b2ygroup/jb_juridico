import React, { useState, useEffect } from 'react';
import './Modal.css'; // Seu CSS de Modal
// Importar funções do Firebase Storage se o upload for feito aqui diretamente
// import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
// import { storage } from './firebaseConfig'; // Se storage for usado aqui

// Constantes para validação de arquivos (pode movê-las para um arquivo de utils)
const MAX_FILE_SIZE_MB_MODAL = 5;
const MAX_FILE_SIZE_BYTES_MODAL = MAX_FILE_SIZE_MB_MODAL * 1024 * 1024;
const ALLOWED_FILE_TYPES_MODAL = [
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg", "image/png", "image/heic", "image/heif", "text/plain"
];

function WorkflowActionModal({ isOpen, onClose, onSubmit, titulo, acao }) {
  const [notas, setNotas] = useState('');
  const [arquivosParaAnexar, setArquivosParaAnexar] = useState([]); // Estado para os arquivos selecionados
  const [erroArquivos, setErroArquivos] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNotas('');
      setArquivosParaAnexar([]); // Limpa arquivos selecionados ao abrir
      setErroArquivos('');
    }
  }, [isOpen]);

  const handleFileChangeModal = (event) => {
    const files = Array.from(event.target.files);
    let arquivosValidos = [];
    let errosTemp = [];

    files.forEach(file => {
        if (arquivosParaAnexar.length + arquivosValidos.length >= 3) { // Limite de 3 arquivos por atualização, por exemplo
            errosTemp.push("Máximo de 3 arquivos por atualização.");
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES_MODAL) {
            errosTemp.push(`"${file.name}" excede ${MAX_FILE_SIZE_MB_MODAL}MB.`);
        } else if (!ALLOWED_FILE_TYPES_MODAL.includes(file.type)) {
            errosTemp.push(`Tipo de "${file.name}" não permitido.`);
        } else if (![...arquivosParaAnexar, ...arquivosValidos].find(f => f.name === file.name)) {
            arquivosValidos.push(file);
        } else {
            errosTemp.push(`"${file.name}" já selecionado.`);
        }
    });

    if (errosTemp.length > 0) {
        setErroArquivos(errosTemp.join("\n"));
    } else {
        setErroArquivos('');
    }
    setArquivosParaAnexar(prev => [...prev, ...arquivosValidos].slice(0, 3));
    event.target.value = null; // Permite selecionar o mesmo arquivo novamente se removido
  };

  const removeArquivoModal = (fileName) => {
    setArquivosParaAnexar(prev => prev.filter(file => file.name !== fileName));
  };

  if (!isOpen) {
    return null;
  }

  const handleSubmitModal = () => {
    // Validação básica de notas, se necessário
    // if (!notas.trim() && acao !== "Recusada") { // Ex: Recusada pode ter motivo obrigatório
    //   setErroArquivos("Por favor, adicione alguma nota para esta ação.");
    //   return;
    // }
    onSubmit(notas, arquivosParaAnexar); // Passa as notas E os arquivos para o onSubmit
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{titulo || `Registrar Informações para: ${acao}`}</h3>
        <div className="form-group">
          <label htmlFor={`workflow-notas-${acao}`}>{`Notas / Observações sobre "${acao}":`}</label>
          <textarea
            id={`workflow-notas-${acao}`}
            rows="6"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder={acao === "Recusada" ? "Descreva o motivo da recusa (será visível ao cliente)." : "Descreva o que foi discutido, decisões, próximos passos, etc."}
          />
        </div>

        <div className="form-group">
          <label htmlFor={`workflow-anexos-${acao}`}>Anexar Novos Documentos (Opcional - até 3 arquivos):</label>
          <input
            type="file"
            id={`workflow-anexos-${acao}`}
            multiple
            onChange={handleFileChangeModal}
            disabled={arquivosParaAnexar.length >= 3}
            style={{ /* Reutilize estilos de input de arquivo ou defina aqui */ }}
            accept={ALLOWED_FILE_TYPES_MODAL.join(",")}
          />
          {arquivosParaAnexar.length > 0 && (
            <div className="arquivos-selecionados-lista" style={{marginTop: '0.5rem', fontSize: '0.85em'}}>
              <p style={{marginBottom:'0.3em'}}>Arquivos a serem anexados a esta atualização:</p>
              <ul style={{listStyle:'none', paddingLeft:0}}>
                {arquivosParaAnexar.map(file => (
                  <li key={file.name} style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.2em'}}>
                    <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    <button type="button" onClick={() => removeArquivoModal(file.name)} style={{background:'none', border:'none', color:'var(--cor-erro)', cursor:'pointer', fontSize:'1.2em'}}>&times;</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {erroArquivos && <pre className="form-feedback error" style={{fontSize:'0.8em', whiteSpace:'pre-wrap', textAlign:'left', marginTop:'0.5rem'}}>{erroArquivos}</pre>}
        </div>
        
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="button-secondary-alt">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmitModal} className="button-primary-alt">
            Salvar e Atualizar Status
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkflowActionModal;